/**
 * MVL UI Feedback — Content Script (Runs on Production, Dev Online & Localhost)
 * - Default mode: Drag-to-Crop Screenshot + Auto-capture Current URL + Multi-Anchor DOM/React Fingerprint + Inline Comment
 * - Dual workflow:
 *   * DEV Mode -> Pushes directly to Cloudflare Remote MCP Server (`/mcp`)
 *   * QA Mode  -> Creates Plane Task using configured Plane PAT (with Project & Module selection) + Saves to MCP
 */

(function () {
  if (window.__MVL_FEEDBACK_CONTENT_LOADED__) return;
  window.__MVL_FEEDBACK_CONTENT_LOADED__ = true;

  let currentConfig = Object.assign({}, window.MVL_DEFAULT_CONFIG || {});
  let floatingPill = null;
  let activeOverlay = null;
  let activeTopBar = null;
  let selectionBox = null;
  let activePopover = null;
  let mediaRecorder = null;
  let recordedChunks = [];

  // Inject MAIN world bridge to inspect React Fiber (`__reactFiber$`) & Performance API
  function injectPageBridge() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL("page-bridge.js");
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
      }
    } catch {
      // Ignore if CSP blocks external script tag
    }
  }

  async function loadConfig() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(["mvlConfig"]);
      if (stored && stored.mvlConfig) {
        currentConfig = Object.assign({}, window.MVL_DEFAULT_CONFIG, stored.mvlConfig);
      }
    }
    updateFloatingPill();
  }

  async function saveConfigPatch(patch) {
    currentConfig = Object.assign({}, currentConfig, patch);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ mvlConfig: currentConfig });
    }
    updateFloatingPill();
  }

  function createFloatingPill() {
    if (floatingPill) return;
    floatingPill = document.createElement("div");
    floatingPill.className = "mvl-fb-floating-pill";
    floatingPill.id = "mvl-fb-floating-pill";
    floatingPill.title = "MVL UI Feedback (Alt+Shift+C): Khoanh vùng Crop ảnh & gửi Feedback";
    floatingPill.addEventListener("click", () => {
      startCaptureFlow(currentConfig.captureType || "crop");
    });
    document.body.appendChild(floatingPill);
    updateFloatingPill();
  }

  function updateFloatingPill() {
    if (!floatingPill) return;
    if (currentConfig.showFloatingButton === false) {
      floatingPill.style.display = "none";
      return;
    }
    floatingPill.style.display = "flex";
    const isQa = (currentConfig.mode || "qa") === "qa";
    floatingPill.innerHTML = `
      <span>✂️ UI Feedback</span>
      <span class="mvl-fb-pill-mode ${isQa ? "qa" : "dev"}">${isQa ? "QA → PLANE" : "DEV → MCP"}</span>
    `;
  }

  function getUniqueCssSelector(el) {
    if (!el || el.nodeType !== 1) return "body";
    if (el.id) return `#${el.id}`;
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && cur !== document.body && depth < 5) {
      depth++;
      let part = cur.tagName.toLowerCase();
      const testId = cur.getAttribute("data-testid") || cur.getAttribute("data-slot");
      if (testId) {
        part += `[data-testid="${testId}"]`;
        parts.unshift(part);
        break;
      }
      if (cur.className && typeof cur.className === "string") {
        const cls = cur.className
          .trim()
          .split(/\s+/)
          .filter((c) => c && !c.startsWith("mvl-fb-"))
          .slice(0, 2);
        if (cls.length) part += "." + cls.join(".");
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(" > ") || "body";
  }

  function extractDomFingerprintInRect(rect) {
    const centerX = Math.min(Math.max(rect.x + rect.width / 2, 4), window.innerWidth - 4);
    const centerY = Math.min(Math.max(rect.y + rect.height / 2, 4), window.innerHeight - 4);
    const targetEl = document.elementFromPoint(centerX, centerY) || document.body;

    const domSelector = getUniqueCssSelector(targetEl);
    const outerHtml = (targetEl.outerHTML || "").slice(0, 350);
    const cs = window.getComputedStyle(targetEl);
    const computedStyles = {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      padding: cs.padding,
      margin: cs.margin,
      display: cs.display,
      borderRadius: cs.borderRadius,
    };

    // Collect visible text anchors inside the cropped rectangle
    const textAnchors = [];
    const candidates = document.querySelectorAll("button, a, h1, h2, h3, h4, th, td, label, span, p, input");
    for (const node of candidates) {
      if (textAnchors.length >= 8) break;
      const r = node.getBoundingClientRect();
      const overlaps =
        r.width > 0 &&
        r.height > 0 &&
        r.right >= rect.x &&
        r.left <= rect.x + rect.width &&
        r.bottom >= rect.y &&
        r.top <= rect.y + rect.height;
      if (overlaps) {
        const txt = (node.innerText || node.getAttribute("placeholder") || node.getAttribute("aria-label") || "").trim();
        if (txt && txt.length >= 2 && txt.length <= 80 && !textAnchors.includes(txt)) {
          textAnchors.push(txt);
        }
      }
    }

    return {
      centerX,
      centerY,
      domSelector,
      domSnippet: outerHtml,
      computedStyles,
      textAnchors,
    };
  }

  function inspectPointViaBridge(x, y) {
    return new Promise((resolve) => {
      const requestId = "req_" + Math.random().toString(36).slice(2);
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve({ reactInfo: { reactComponent: "", reactSource: "", reactProps: {} }, recentApis: [] });
      }, 300);

      function handler(ev) {
        if (ev.data?.type === "MVL_INSPECT_POINT_RESPONSE" && ev.data.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve({
            reactInfo: ev.data.reactInfo || {},
            recentApis: ev.data.recentApis || [],
          });
        }
      }
      window.addEventListener("message", handler);
      window.postMessage({ type: "MVL_INSPECT_POINT_REQUEST", x, y, requestId }, "*");
    });
  }

  async function captureAndCropRect(rect) {
    let fullDataUrl = null;
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const res = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "MVL_CAPTURE_VISIBLE_TAB" }, (r) => resolve(r));
        });
        if (res && res.ok && res.dataUrl) {
          fullDataUrl = res.dataUrl;
        }
      } catch {
        fullDataUrl = null;
      }
    }

    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    const w = Math.max(Math.round(rect.width), 40);
    const h = Math.max(Math.round(rect.height), 30);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");

    if (fullDataUrl) {
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(
            img,
            rect.x * dpr,
            rect.y * dpr,
            w * dpr,
            h * dpr,
            0,
            0,
            w * dpr,
            h * dpr
          );
          resolve();
        };
        img.onerror = () => resolve();
        img.src = fullDataUrl;
      });
      return canvas.toDataURL("image/png");
    }

    // Fallback visual snapshot if run outside extension background tab capture
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText(`Crop Region (${w}x${h}) @ ${window.location.pathname}`, 12, 26);
    ctx.fillStyle = "#93c5fd";
    ctx.font = "11px monospace";
    ctx.fillText(window.location.href.slice(0, 56), 12, 46);
    return canvas.toDataURL("image/png");
  }

  function cleanupOverlay() {
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
    if (activeTopBar) {
      activeTopBar.remove();
      activeTopBar = null;
    }
    if (selectionBox) {
      selectionBox.remove();
      selectionBox = null;
    }
  }

  function closePopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }
    if (floatingPill) updateFloatingPill();
  }

  function startCaptureFlow(initialCaptureType = "crop") {
    cleanupOverlay();
    closePopover();
    if (floatingPill) floatingPill.style.display = "none";

    if (initialCaptureType === "video") {
      startVideoCaptureFlow();
      return;
    }

    activeTopBar = document.createElement("div");
    activeTopBar.className = "mvl-fb-top-bar";
    const isQa = (currentConfig.mode || "qa") === "qa";
    activeTopBar.innerHTML = `
      <span><strong>✂️ Kéo chuột khoanh vùng Crop</strong> (hoặc Click phần tử)</span>
      <button type="button" id="mvl-top-mode-dev" class="${!isQa ? "active" : ""}">👨‍💻 DEV → MCP</button>
      <button type="button" id="mvl-top-mode-qa" class="${isQa ? "qa-active" : ""}">🕵️‍♀️ QA → Plane</button>
      <button type="button" id="mvl-top-switch-video">🎥 Quay Video</button>
      <button type="button" id="mvl-top-cancel">✕ Thoát (ESC)</button>
    `;
    document.body.appendChild(activeTopBar);

    activeTopBar.querySelector("#mvl-top-mode-dev").addEventListener("click", (e) => {
      e.stopPropagation();
      saveConfigPatch({ mode: "dev" });
      activeTopBar.querySelector("#mvl-top-mode-dev").className = "active";
      activeTopBar.querySelector("#mvl-top-mode-qa").className = "";
    });
    activeTopBar.querySelector("#mvl-top-mode-qa").addEventListener("click", (e) => {
      e.stopPropagation();
      saveConfigPatch({ mode: "qa" });
      activeTopBar.querySelector("#mvl-top-mode-dev").className = "";
      activeTopBar.querySelector("#mvl-top-mode-qa").className = "qa-active";
    });
    activeTopBar.querySelector("#mvl-top-switch-video").addEventListener("click", (e) => {
      e.stopPropagation();
      startVideoCaptureFlow();
    });
    activeTopBar.querySelector("#mvl-top-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      cleanupOverlay();
      updateFloatingPill();
    });

    activeOverlay = document.createElement("div");
    activeOverlay.className = "mvl-fb-overlay";
    document.body.appendChild(activeOverlay);

    selectionBox = document.createElement("div");
    selectionBox.className = "mvl-fb-selection-box";
    selectionBox.style.display = "none";
    document.body.appendChild(selectionBox);

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function onMouseDown(e) {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.display = "block";
      selectionBox.style.left = `${startX}px`;
      selectionBox.style.top = `${startY}px`;
      selectionBox.style.width = "0px";
      selectionBox.style.height = "0px";
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      selectionBox.style.left = `${x}px`;
      selectionBox.style.top = `${y}px`;
      selectionBox.style.width = `${w}px`;
      selectionBox.style.height = `${h}px`;
    }

    async function onMouseUp(e) {
      if (!isDragging) return;
      isDragging = false;
      let x = Math.min(startX, e.clientX);
      let y = Math.min(startY, e.clientY);
      let w = Math.abs(e.clientX - startX);
      let h = Math.abs(e.clientY - startY);

      cleanupOverlay();

      // If user clicked a single point without dragging, snap to target DOM element bounding box
      if (w < 12 && h < 12) {
        const el = document.elementFromPoint(e.clientX, e.clientY) || document.body;
        const r = el.getBoundingClientRect();
        x = Math.max(0, r.left - 6);
        y = Math.max(0, r.top - 6);
        w = Math.min(window.innerWidth - x, Math.max(r.width + 12, 120));
        h = Math.min(window.innerHeight - y, Math.max(r.height + 12, 60));
      }

      const cropRect = {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      const domFp = extractDomFingerprintInRect(cropRect);
      const bridgeData = await inspectPointViaBridge(domFp.centerX, domFp.centerY);

      // Wait one animation frame so overlay is completely gone before screenshot
      await new Promise((r) => setTimeout(r, 40));
      const croppedDataUrl = await captureAndCropRect(cropRect);

      const fingerprint = {
        domSelector: domFp.domSelector,
        domSnippet: domFp.domSnippet,
        computedStyles: domFp.computedStyles,
        textAnchors: domFp.textAnchors,
        reactComponent: bridgeData.reactInfo?.reactComponent || "",
        reactSource: bridgeData.reactInfo?.reactSource || "",
        reactProps: bridgeData.reactInfo?.reactProps || {},
        recentApis: bridgeData.recentApis || [],
      };

      openFeedbackPopover({
        mediaType: "image",
        mediaDataUrl: croppedDataUrl,
        cropRect,
        fingerprint,
      });
    }

    activeOverlay.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, { once: true });
  }

  async function startVideoCaptureFlow() {
    cleanupOverlay();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunks.push(ev.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        cleanupOverlay();
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result;
          const domFp = extractDomFingerprintInRect({
            x: 100,
            y: 100,
            width: window.innerWidth - 200,
            height: window.innerHeight - 200,
          });
          const bridgeData = await inspectPointViaBridge(window.innerWidth / 2, window.innerHeight / 2);
          openFeedbackPopover({
            mediaType: "video",
            mediaDataUrl: dataUrl,
            cropRect: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
            fingerprint: {
              domSelector: domFp.domSelector,
              domSnippet: domFp.domSnippet,
              computedStyles: domFp.computedStyles,
              textAnchors: domFp.textAnchors,
              reactComponent: bridgeData.reactInfo?.reactComponent || "",
              reactSource: bridgeData.reactInfo?.reactSource || "",
              reactProps: bridgeData.reactInfo?.reactProps || {},
              recentApis: bridgeData.recentApis || [],
            },
          });
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      activeTopBar = document.createElement("div");
      activeTopBar.className = "mvl-fb-top-bar";
      activeTopBar.innerHTML = `
        <span>🔴 <strong>Đang quay Video màn hình...</strong> Thao tác lỗi rồi bấm Dừng</span>
        <button type="button" id="mvl-stop-video" class="active">⏹️ Dừng & Nhập Comment</button>
      `;
      document.body.appendChild(activeTopBar);
      activeTopBar.querySelector("#mvl-stop-video").addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      });
    } catch {
      updateFloatingPill();
    }
  }

  function openFeedbackPopover({ mediaType, mediaDataUrl, cropRect, fingerprint }) {
    closePopover();

    const pageUrl = window.location.href;
    const detected = window.detectMvlContextFromUrl
      ? window.detectMvlContextFromUrl(pageUrl, currentConfig)
      : {
          env: "DEV-ONL",
          projectId: currentConfig.defaultProjectId,
          projectCode: currentConfig.defaultProjectCode,
          moduleId: "",
          moduleName: "",
        };

    let selectedMode = currentConfig.mode || "qa";
    let selectedEnv = detected.env || "DEV-ONL";
    let selectedProjectId = detected.projectId;
    let selectedModuleId = detected.moduleId;
    let selectedPriority = currentConfig.defaultPriority || "medium";

    activePopover = document.createElement("div");
    activePopover.className = "mvl-fb-popover";
    activePopover.id = "mvl-fb-popover";

    // Position popover near the cropped area, clamped inside viewport
    const popWidth = 390;
    const popHeight = 350;
    let left = cropRect.x + cropRect.width + 14;
    if (left + popWidth > window.innerWidth - 12) {
      left = Math.max(12, cropRect.x - popWidth - 14);
    }
    if (left < 12) left = Math.max(12, Math.min(cropRect.x, window.innerWidth - popWidth - 12));
    let top = Math.min(Math.max(12, cropRect.y), Math.max(12, window.innerHeight - popHeight - 16));

    activePopover.style.left = `${left}px`;
    activePopover.style.top = `${top}px`;

    function getEnabledProjects() {
      const all = currentConfig.projects || window.MVL_DEFAULT_CONFIG.projects || [];
      const enabled = currentConfig.enabledProjectCodes || [];
      if (!enabled.length) return all;
      const filtered = all.filter((p) => enabled.includes(p.identifier));
      return filtered.length ? filtered : all;
    }

    function getModulesForProject(pid) {
      const map = currentConfig.modulesByProject || window.MVL_DEFAULT_CONFIG.modulesByProject || {};
      return map[pid] || [];
    }

    function renderPopoverContent() {
      const isQa = selectedMode === "qa";
      const enabledProjects = getEnabledProjects();
      const modules = getModulesForProject(selectedProjectId);
      const compLabel =
        fingerprint.reactComponent ||
        fingerprint.domSelector ||
        "DOM Element";
      const patUser =
        currentConfig.planeUser?.first_name ||
        currentConfig.planeUser?.display_name ||
        "Pham Hung";

      activePopover.innerHTML = `
        <div class="mvl-fb-popover-header">
          <div class="mvl-fb-mode-switch">
            <button type="button" id="mvl-pop-mode-dev" class="${!isQa ? "active-dev" : ""}">👨‍💻 DEV (Bắn vào MCP)</button>
            <button type="button" id="mvl-pop-mode-qa" class="${isQa ? "active-qa" : ""}">🕵️‍♀️ QA (Tạo Task Plane)</button>
          </div>
          <span class="mvl-fb-env-badge ${selectedEnv}" id="mvl-pop-env-badge" title="Click để đổi môi trường">[${selectedEnv}]</span>
        </div>

        <div class="mvl-fb-preview-row">
          ${
            mediaType === "video"
              ? `<div class="mvl-fb-preview-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px;">🎥</div>`
              : `<img class="mvl-fb-preview-thumb" src="${mediaDataUrl}" alt="Crop Preview" />`
          }
          <div class="mvl-fb-meta-col">
            <div class="mvl-fb-url-line" title="${pageUrl}">🔗 ${pageUrl}</div>
            <div class="mvl-fb-comp-line" title="${compLabel}">🧬 ${compLabel}</div>
            <div class="mvl-fb-comp-line" style="color:#94a3b8;">📐 Vùng chọn: ${cropRect.width}×${cropRect.height}px</div>
          </div>
        </div>

        <div class="mvl-fb-qa-selectors" style="display: ${isQa ? "grid" : "none"};">
          <div class="mvl-fb-field">
            <label>Dự án Plane (Auto-detected)</label>
            <select id="mvl-pop-project">
              ${enabledProjects
                .map(
                  (p) =>
                    `<option value="${p.id}" data-code="${p.identifier}" ${
                      p.id === selectedProjectId ? "selected" : ""
                    }>[${p.identifier}] ${p.name}</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="mvl-fb-field">
            <label>Module / Phân hệ</label>
            <select id="mvl-pop-module">
              <option value="">-- Không gắn Module --</option>
              ${modules
                .map(
                  (m) =>
                    `<option value="${m.id}" data-name="${m.name}" ${
                      m.id === selectedModuleId ? "selected" : ""
                    }>${m.name}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        <textarea
          id="mvl-pop-comment"
          class="mvl-fb-textarea"
          placeholder="${
            isQa
              ? "Nhập mô tả lỗi UI / Nghiệp vụ... (Ấn Cmd+Enter để tạo Task lên Plane)"
              : "Nhập yêu cầu sửa UI cho AI... (Ấn Cmd+Enter để bắn thẳng vào MCP)"
          }"
        ></textarea>

        <div class="mvl-fb-actions">
          <div class="mvl-fb-pat-badge" title="Account Plane PAT đang gắn">
            ${
              isQa
                ? `🔑 PAT: ${patUser} (${currentConfig.planeWorkspaceSlug || "glinteco"})`
                : `⚡ Cloudflare Remote MCP Queue`
            }
          </div>
          <div class="mvl-fb-btn-group">
            <button type="button" class="mvl-fb-btn-cancel" id="mvl-pop-cancel">Hủy</button>
            <button type="button" class="mvl-fb-btn-submit ${isQa ? "qa" : ""}" id="mvl-pop-submit">
              ${isQa ? "🚀 Tạo Task Plane" : "⚡ Bắn vào MCP"}
            </button>
          </div>
        </div>
      `;

      // Bind mode switches
      activePopover.querySelector("#mvl-pop-mode-dev").addEventListener("click", () => {
        selectedMode = "dev";
        saveConfigPatch({ mode: "dev" });
        renderPopoverContent();
      });
      activePopover.querySelector("#mvl-pop-mode-qa").addEventListener("click", () => {
        selectedMode = "qa";
        saveConfigPatch({ mode: "qa" });
        renderPopoverContent();
      });

      // Bind Env badge cycle (PROD -> DEV-ONL -> LOCAL)
      activePopover.querySelector("#mvl-pop-env-badge").addEventListener("click", () => {
        const order = ["DEV-ONL", "PROD", "LOCAL"];
        selectedEnv = order[(order.indexOf(selectedEnv) + 1) % order.length];
        renderPopoverContent();
      });

      // Bind project change -> reload modules
      const projSelect = activePopover.querySelector("#mvl-pop-project");
      if (projSelect) {
        projSelect.addEventListener("change", async (e) => {
          selectedProjectId = e.target.value;
          const existingMods = getModulesForProject(selectedProjectId);
          if (!existingMods.length && typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage(
              {
                type: "MVL_FETCH_MODULES",
                workerBaseUrl: currentConfig.workerBaseUrl,
                pat: currentConfig.planePat,
                projectId: selectedProjectId,
              },
              (res) => {
                if (res?.ok && Array.isArray(res.modules)) {
                  currentConfig.modulesByProject = Object.assign({}, currentConfig.modulesByProject, {
                    [selectedProjectId]: res.modules,
                  });
                  selectedModuleId = res.modules[0]?.id || "";
                  renderPopoverContent();
                }
              }
            );
          } else {
            selectedModuleId = existingMods[0]?.id || "";
            renderPopoverContent();
          }
        });
      }

      const modSelect = activePopover.querySelector("#mvl-pop-module");
      if (modSelect) {
        modSelect.addEventListener("change", (e) => {
          selectedModuleId = e.target.value;
        });
      }

      activePopover.querySelector("#mvl-pop-cancel").addEventListener("click", () => {
        closePopover();
      });

      const commentInput = activePopover.querySelector("#mvl-pop-comment");
      const submitBtn = activePopover.querySelector("#mvl-pop-submit");

      commentInput.focus();
      commentInput.addEventListener("keydown", (ev) => {
        if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
          ev.preventDefault();
          submitBtn.click();
        } else if (ev.key === "Escape") {
          closePopover();
        }
      });

      submitBtn.addEventListener("click", async () => {
        const comment = commentInput.value.trim();
        if (!comment) {
          commentInput.style.borderColor = "#ef4444";
          commentInput.focus();
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang gửi...";

        const allProjects = getEnabledProjects();
        const projObj = allProjects.find((p) => p.id === selectedProjectId) || allProjects[0];
        const mods = getModulesForProject(selectedProjectId);
        const modObj = mods.find((m) => m.id === selectedModuleId);

        const payload = {
          mode: selectedMode,
          env: selectedEnv,
          pageUrl,
          comment,
          mediaType,
          mediaDataUrl,
          cropRect,
          fingerprint,
          planeConfig: {
            pat: currentConfig.planePat || "DEFAULT_CONNECTED_ACCOUNT",
            hostUrl: currentConfig.planeHostUrl || "https://pm.glinteco.com",
            workspaceSlug: currentConfig.planeWorkspaceSlug || "glinteco",
            projectId: projObj ? projObj.id : currentConfig.defaultProjectId,
            projectCode: projObj ? projObj.identifier : currentConfig.defaultProjectCode,
            moduleId: modObj ? modObj.id : "",
            moduleName: modObj ? modObj.name : "",
            priority: selectedPriority,
            reporterName:
              currentConfig.planeUser?.first_name ||
              currentConfig.planeUser?.display_name ||
              "Pham Hung",
            reporterEmail: currentConfig.planeUser?.email || "hung.phamduc@glinteco.com",
          },
        };

        let result = null;
        const workerBase = (
          currentConfig.workerBaseUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev"
        ).replace(/\/+$/, "");

        try {
          const resp = await fetch(`${workerBase}/api/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          result = await resp.json();
        } catch (err) {
          result = { ok: false, error: err.message || String(err) };
        }

        if (!result || !result.ok) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Thử lại";
          showToast(`❌ Lỗi khi gửi: ${result?.error || "Không xác định"}`, true);
          return;
        }

        closePopover();
        if (selectedMode === "qa" && result.planeIssue) {
          showToast(
            `✅ Đã tạo Task Plane: <a href="${result.planeIssue.url}" target="_blank">[${result.planeIssue.identifier}]</a> (${result.planeIssue.moduleName || result.planeIssue.projectCode})<br/><span style="font-size:11px;color:#94a3b8;">Đã lưu ảnh Crop R2 & ngữ cảnh vào MCP!</span>`
          );
        } else {
          showToast(
            `⚡ Đã bắn vào Cloudflare MCP: <strong>${result.id}</strong><br/><span style="font-size:11px;color:#93c5fd;">Gõ với AI: "Xử lý feedback UI mới nhất (${result.id})"</span>`
          );
        }
      });
    }

    document.body.appendChild(activePopover);
    renderPopoverContent();
  }

  function showToast(htmlContent, isError = false) {
    const toast = document.createElement("div");
    toast.className = "mvl-fb-toast";
    if (isError) toast.style.borderColor = "#ef4444";
    toast.innerHTML = htmlContent;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 7000);
  }

  // Listen to messages from Extension Popup or Background Shortcut
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "MVL_START_CAPTURE") {
        loadConfig().then(() => {
          if (msg.mode) currentConfig.mode = msg.mode;
          startCaptureFlow(msg.captureType || "crop");
          sendResponse({ ok: true });
        });
        return true;
      }
      if (msg?.type === "MVL_CONFIG_UPDATED") {
        loadConfig().then(() => sendResponse({ ok: true }));
        return true;
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeOverlay) {
      cleanupOverlay();
      updateFloatingPill();
    } else if (e.altKey && e.shiftKey && (e.key === "C" || e.key === "c")) {
      e.preventDefault();
      startCaptureFlow("crop");
    }
  });

  // Expose helper for programmatic verification / E2E tests
  window.__MVL_FEEDBACK_WIDGET__ = {
    startCaptureFlow,
    openFeedbackPopover,
    getConfig: () => currentConfig,
    setMode: (mode) => saveConfigPatch({ mode }),
  };

  injectPageBridge();
  loadConfig().then(() => {
    createFloatingPill();
  });
})();
