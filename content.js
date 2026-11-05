/**
 * MVL UI Feedback — Content Script (Runs on Production, Dev Online & Localhost)
 * Design-Engineered UI: Crisp SVG icons, Hero Crop Preview, Live Dimension Readout,
 * Segmented DEV/QA Switcher, Auto-Detect Project/Module & Keyboard-first ergonomics.
 */

(function () {
  if (window.__MVL_FEEDBACK_CONTENT_LOADED__) return;
  window.__MVL_FEEDBACK_CONTENT_LOADED__ = true;

  const ICONS = {
    crop: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`,
    video: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    terminal: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    layers: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    link: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    code: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    send: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  };

  let currentConfig = Object.assign({}, window.MVL_DEFAULT_CONFIG || {});
  let floatingPill = null;
  let activeOverlay = null;
  let activeTopBar = null;
  let selectionBox = null;
  let activePopover = null;
  let mediaRecorder = null;
  let recordedChunks = [];

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
    floatingPill.title = "MVL UI Feedback (Alt+Shift+C): Khoanh vùng chụp ảnh Crop & gửi Feedback";
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
    floatingPill.style.display = "inline-flex";
    const isQa = (currentConfig.mode || "qa") === "qa";
    floatingPill.innerHTML = `
      <span class="mvl-fb-pill-icon">${ICONS.crop}</span>
      <span>Feedback</span>
      <span class="mvl-fb-pill-dot ${isQa ? "qa" : "dev"}"></span>
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

    // Crisp fallback card if run in automated headless DOM mode without extension background tab capture
    ctx.scale(dpr, dpr);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(96, 165, 250, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`Cropped UI Region (${w} × ${h}px)`, 14, 28);
    ctx.fillStyle = "#93c5fd";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(window.location.href.slice(0, 58), 14, 48);
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
    activeTopBar.innerHTML = `
      <span class="mvl-fb-top-hint">${ICONS.crop} <span>Drag to crop or click element</span></span>
      <button type="button" id="mvl-top-switch-video">${ICONS.video} <span>Video</span></button>
      <button type="button" id="mvl-top-cancel">${ICONS.close} <span>Esc</span></button>
    `;
    document.body.appendChild(activeTopBar);

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
    selectionBox.innerHTML = `<div class="mvl-fb-selection-dims" id="mvl-fb-dims-pill">0 × 0</div>`;
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
      const w = Math.round(Math.abs(e.clientX - startX));
      const h = Math.round(Math.abs(e.clientY - startY));
      selectionBox.style.left = `${x}px`;
      selectionBox.style.top = `${y}px`;
      selectionBox.style.width = `${w}px`;
      selectionBox.style.height = `${h}px`;
      const dimsEl = selectionBox.querySelector("#mvl-fb-dims-pill");
      if (dimsEl) dimsEl.textContent = `${w} × ${h} px`;
    }

    async function onMouseUp(e) {
      if (!isDragging) return;
      isDragging = false;
      let x = Math.min(startX, e.clientX);
      let y = Math.min(startY, e.clientY);
      let w = Math.abs(e.clientX - startX);
      let h = Math.abs(e.clientY - startY);

      cleanupOverlay();

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
        <span class="mvl-fb-top-hint">${ICONS.video} <span>Đang quay Video màn hình...</span></span>
        <button type="button" id="mvl-stop-video" class="active">Dừng & Nhập Comment</button>
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

    const popWidth = 410;
    const popHeight = 415;
    let left = cropRect.x + cropRect.width + 16;
    if (left + popWidth > window.innerWidth - 14) {
      left = Math.max(14, cropRect.x - popWidth - 16);
    }
    if (left < 14) left = Math.max(14, Math.min(cropRect.x, window.innerWidth - popWidth - 14));
    let top = Math.min(Math.max(14, cropRect.y), Math.max(14, window.innerHeight - popHeight - 16));

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

      const shortPath = (() => {
        try {
          const u = new URL(pageUrl);
          return (u.pathname || "/") + (u.search ? u.search.slice(0, 20) : "");
        } catch {
          return pageUrl;
        }
      })();

      activePopover.innerHTML = `
        <div class="mvl-fb-popover-header">
          <div class="mvl-fb-header-left">
            <span class="mvl-fb-mode-tag">
              <span class="mvl-fb-mode-dot ${isQa ? "qa" : "dev"}"></span>
              <span>${isQa ? "New Plane Issue" : "Send to AI MCP"}</span>
            </span>
          </div>
          <div class="mvl-fb-header-right">
            <span class="mvl-fb-env-badge ${selectedEnv}" id="mvl-pop-env-badge" title="Switch environment">${selectedEnv}</span>
            <button type="button" class="mvl-fb-icon-close" id="mvl-pop-close-x" title="Close">${ICONS.close}</button>
          </div>
        </div>

        <div class="mvl-fb-crop-card">
          <div class="mvl-fb-crop-stage">
            ${
              mediaType === "video"
                ? `<div style="display:flex;align-items:center;gap:6px;color:#60a5fa;font-weight:600;">${ICONS.video} <span>Video Clip Ready</span></div>`
                : `<img class="mvl-fb-preview-thumb" src="${mediaDataUrl}" alt="Crop Preview" />`
            }
            <span class="mvl-fb-crop-dim-tag">${cropRect.width} × ${cropRect.height}</span>
          </div>
          <div class="mvl-fb-meta-strip">
            <span class="mvl-fb-meta-path" title="${pageUrl}">${shortPath}</span>
            <code class="mvl-fb-meta-selector" title="${compLabel}">${compLabel}</code>
          </div>
        </div>

        <div class="mvl-fb-qa-selectors" style="display: ${isQa ? "grid" : "none"};">
          <div class="mvl-fb-field">
            <select id="mvl-pop-project" title="Plane Project">
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
            <select id="mvl-pop-module" title="Module">
              <option value="">No Module</option>
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

        <div class="mvl-fb-priority-bar" style="display: ${isQa ? "grid" : "none"};" role="radiogroup">
          <button type="button" class="mvl-fb-prio-btn ${selectedPriority === "urgent" ? "active" : ""}" data-prio="urgent">Urgent</button>
          <button type="button" class="mvl-fb-prio-btn ${selectedPriority === "high" ? "active" : ""}" data-prio="high">High</button>
          <button type="button" class="mvl-fb-prio-btn ${selectedPriority === "medium" ? "active" : ""}" data-prio="medium">Medium</button>
          <button type="button" class="mvl-fb-prio-btn ${selectedPriority === "low" ? "active" : ""}" data-prio="low">Low</button>
        </div>

        <div class="mvl-fb-textarea-wrap">
          <textarea
            id="mvl-pop-comment"
            class="mvl-fb-textarea"
            placeholder="${
              isQa
                ? "Add a comment or bug description..."
                : "Describe the UI change for AI..."
            }"
          ></textarea>
          <span class="mvl-fb-kbd-hint">⌘↵</span>
        </div>

        <div class="mvl-fb-actions">
          <span class="mvl-fb-pat-badge">
            ${isQa ? `${patUser} · ${currentConfig.planeWorkspaceSlug || "plane"}` : "Remote MCP"}
          </span>
          <div class="mvl-fb-btn-group">
            <button type="button" class="mvl-fb-btn-cancel" id="mvl-pop-cancel">Cancel</button>
            <button type="button" class="mvl-fb-btn-submit ${isQa ? "qa" : ""}" id="mvl-pop-submit">
              ${ICONS.send}
              <span>${isQa ? "Create Issue" : "Send to MCP"}</span>
            </button>
          </div>
        </div>
      `;

      activePopover.querySelectorAll(".mvl-fb-prio-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedPriority = btn.getAttribute("data-prio") || "medium";
          activePopover.querySelectorAll(".mvl-fb-prio-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
        });
      });

      const closeX = activePopover.querySelector("#mvl-pop-close-x");
      if (closeX) closeX.addEventListener("click", closePopover);

      activePopover.querySelector("#mvl-pop-env-badge").addEventListener("click", () => {
        const order = ["DEV-ONL", "PROD", "LOCAL"];
        selectedEnv = order[(order.indexOf(selectedEnv) + 1) % order.length];
        renderPopoverContent();
      });

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
        submitBtn.innerHTML = `<span>Đang đồng bộ...</span>`;

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
          submitBtn.innerHTML = `${ICONS.send} <span>Thử lại</span>`;
          showToast(`Không thể gửi: ${result?.error || "Lỗi kết nối"}`, true);
          return;
        }

        closePopover();
        if (selectedMode === "qa" && result.planeIssue) {
          showToast(
            `<div style="font-weight:600;margin-bottom:2px;">Đã tạo Task trên Plane: <a href="${result.planeIssue.url}" target="_blank">${result.planeIssue.identifier}</a></div><div style="font-size:11px;color:#94a3b8;">Phân hệ: ${result.planeIssue.moduleName || result.planeIssue.projectCode} · Đã lưu ảnh Crop R2 & MCP</div>`
          );
        } else {
          showToast(
            `<div style="font-weight:600;margin-bottom:2px;">Đã đẩy vào Cloudflare MCP · <code style="color:#93c5fd;">${result.id}</code></div><div style="font-size:11px;color:#94a3b8;">Nhắn AI: "Xử lý feedback UI mới nhất (${result.id})"</div>`
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
    if (isError) toast.style.borderColor = "rgba(239, 68, 68, 0.55)";
    toast.innerHTML = htmlContent;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 6500);
  }

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
