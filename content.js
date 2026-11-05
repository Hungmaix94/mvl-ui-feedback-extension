/**
 * SnapUI — Content Script (v2.1 Bright Daylight + Multi-Crop & Multi-Comment Batching)
 * - Ultra-compact 332px bright popover
 * - Multi-Crop Filmstrip: Capture multiple screenshots (+ Crop) & multiple comments (+ Note) into 1 Plane Issue or 1 AI MCP Batch
 * - Auto-Detect Project/Module & Keyboard-first ergonomics (Cmd+Enter)
 */

(function () {
  if (window.__MVL_FEEDBACK_CONTENT_LOADED__) return;
  window.__MVL_FEEDBACK_CONTENT_LOADED__ = true;

  const ICONS = {
    crop: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`,
    video: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    plus: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    send: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    check: `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    link: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    copy: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    bot: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
  };

  let currentConfig = Object.assign({}, window.MVL_DEFAULT_CONFIG || {});
  let floatingPill = null;
  let activeOverlay = null;
  let activeTopBar = null;
  let selectionBox = null;
  let activePopover = null;
  let mediaRecorder = null;
  let recordedChunks = [];

  // Multi-Crop / Multi-Comment Batch State & On-Page Visual Pins
  const MAX_SHOTS = 8;
  let batchItems = [];
  let activeItemIndex = 0;
  let submittedPins = [];
  let pinsLayer = null;

  function renderOnPagePins() {
    if (!batchItems.length && !submittedPins.length) {
      if (pinsLayer) {
        pinsLayer.remove();
        pinsLayer = null;
      }
      return;
    }
    if (!pinsLayer) {
      pinsLayer = document.createElement("div");
      pinsLayer.className = "mvl-fb-pins-layer";
      pinsLayer.id = "mvl-fb-pins-layer";
      document.body.appendChild(pinsLayer);
    }

    const isQa = (currentConfig.mode || "qa") === "qa";

    const submittedHtml = submittedPins
      .map((sp, sIdx) => {
        const r = sp.cropRect || { x: 80, y: 80, width: 160, height: 80 };
        const pIdx = sp.pinOffset || 0;
        const headerTop = pIdx === 0 ? -28 : (pIdx - 1) * 28 + 6;
        const headerLeft = pIdx === 0 ? -2 : 6;
        const label = sp.issueKey ? `${sp.issueKey} · #${sp.index}` : `#${sp.index}`;
        return `
          <div class="mvl-fb-pin-box submitted ${isQa ? "qa" : ""}" style="left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;" data-submitted-idx="${sIdx}">
            <div class="mvl-fb-pin-header" style="top:${headerTop}px;left:${headerLeft}px;">
              <span class="mvl-fb-pin-badge">${escapeHtml(label)}</span>
              <span class="mvl-fb-pin-bubble">${escapeHtml(sp.comment || "Submitted")}</span>
            </div>
          </div>
        `;
      })
      .join("");

    // Track overlapping cropRects (e.g. when clicking "+ Note" on the same crop) so pin headers stack cleanly
    const rectCounts = {};
    const draftHtml = batchItems
      .map((it, idx) => {
        const r = it.cropRect || { x: 100, y: 100, width: 200, height: 100 };
        const rectKey = `${r.x}_${r.y}_${r.width}_${r.height}`;
        const stackIdx = rectCounts[rectKey] || 0;
        rectCounts[rectKey] = stackIdx + 1;
        const headerTop = stackIdx === 0 ? -28 : (stackIdx - 1) * 28 + 6;
        const headerLeft = stackIdx === 0 ? -2 : 6;
        const isActive = idx === activeItemIndex;
        const noteText = (it.comment || "").trim();
        return `
          <div class="mvl-fb-pin-box ${isQa ? "qa" : ""} ${isActive ? "active" : ""}" style="left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;" data-pin-box-idx="${idx}">
            <div class="mvl-fb-pin-header" style="top:${headerTop}px;left:${headerLeft}px;" data-pin-idx="${idx}" title="Click to edit comment #${idx + 1}">
              <span class="mvl-fb-pin-badge">#${idx + 1}</span>
              <span class="mvl-fb-pin-bubble" data-pin-bubble-idx="${idx}">${
                noteText ? escapeHtml(noteText) : "<em>Typing comment...</em>"
              }</span>
            </div>
          </div>
        `;
      })
      .join("");

    pinsLayer.innerHTML = submittedHtml + draftHtml;

    pinsLayer.querySelectorAll("[data-pin-idx]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (activePopover) {
          const curInput = activePopover.querySelector("#mvl-pop-comment");
          if (curInput && batchItems[activeItemIndex]) {
            batchItems[activeItemIndex].comment = curInput.value;
          }
        }
        const targetIdx = Number(el.getAttribute("data-pin-idx")) || 0;
        activeItemIndex = targetIdx;
        openFeedbackPopover(null);
      });
    });
  }

  /**
   * P0 Security: Robust HTML entity sanitizer
   */
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

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
    currentConfig = Object.assign({}, window.MVL_DEFAULT_CONFIG);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(["mvlConfig"]);
      if (stored && stored.mvlConfig) {
        currentConfig = Object.assign({}, window.MVL_DEFAULT_CONFIG, stored.mvlConfig);
      }
    }
    updateFloatingPill();
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.mvlConfig?.newValue) {
        currentConfig = Object.assign({}, window.MVL_DEFAULT_CONFIG, changes.mvlConfig.newValue);
        updateFloatingPill();
      }
    });
  }

  function createFloatingPill() {
    if (floatingPill) return;
    floatingPill = document.createElement("button");
    floatingPill.type = "button";
    floatingPill.className = "mvl-fb-floating-pill";
    floatingPill.id = "mvl-fb-floating-pill";
    floatingPill.title = "SnapUI (Alt+Shift+C): Crop & Comment";
    floatingPill.setAttribute("aria-label", "SnapUI (Alt+Shift+C): Crop & Comment");
    floatingPill.addEventListener("click", () => {
      loadConfig().then(() => {
        if (batchItems.length > 0 && !activePopover) {
          openFeedbackPopover(null);
        } else {
          startCaptureFlow(currentConfig.captureType || "crop", false);
        }
      });
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
    const totalCount = batchItems.length || submittedPins.length;
    const countBadge =
      totalCount > 0
        ? `<span class="mvl-fb-pill-count">${totalCount}</span>`
        : "";
    const clearPinsBtn =
      submittedPins.length > 0 && batchItems.length === 0
        ? `<span class="mvl-fb-pill-clear" id="mvl-fb-clear-pins" title="Clear ${submittedPins.length} pins on page">×</span>`
        : "";
    floatingPill.innerHTML = `
      <span class="mvl-fb-pill-icon">${ICONS.crop}</span>
      <span>Feedback</span>
      ${countBadge}
      ${clearPinsBtn}
      <span class="mvl-fb-pill-dot ${isQa ? "qa" : "dev"}"></span>
    `;
    const clearBtn = floatingPill.querySelector("#mvl-fb-clear-pins");
    if (clearBtn) {
      clearBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        submittedPins = [];
        renderOnPagePins();
        updateFloatingPill();
      });
    }
  }

  function getUniqueCssSelector(el) {
    if (!el || el.nodeType !== 1) return "body";
    if (el.id) return `#${el.id}`;
    const parts = [];
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType !== 1 && cur !== document.body && depth < 5) {
      cur = cur.parentElement;
    }
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

    ctx.scale(dpr, dpr);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#eff6ff");
    grad.addColorStop(1, "#dbeafe");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = "#1e3a8a";
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${w}×${h}`, 8, 20);
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

  function closePopover(clearBatch = true) {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }
    if (clearBatch) {
      batchItems = [];
      activeItemIndex = 0;
    }
    renderOnPagePins();
    if (floatingPill) updateFloatingPill();
  }

  function startCaptureFlow(initialCaptureType = "crop", appendToBatch = false) {
    cleanupOverlay();
    if (!appendToBatch) {
      closePopover(true);
    } else if (activePopover) {
      activePopover.style.display = "none";
    }
    if (floatingPill) floatingPill.style.display = "none";

    if (initialCaptureType === "video") {
      startVideoCaptureFlow(appendToBatch);
      return;
    }

    const batchTag =
      appendToBatch && batchItems.length > 0
        ? `Adding crop #${batchItems.length + 1}`
        : "Drag to crop or click element";

    activeTopBar = document.createElement("div");
    activeTopBar.className = "mvl-fb-top-bar";
    activeTopBar.innerHTML = `
      <span class="mvl-fb-top-hint">${ICONS.crop} <span>${batchTag}</span></span>
      <button type="button" id="mvl-top-switch-video">${ICONS.video} <span>Video</span></button>
      <button type="button" id="mvl-top-cancel">${ICONS.close} <span>Esc</span></button>
    `;
    document.body.appendChild(activeTopBar);

    activeTopBar.querySelector("#mvl-top-switch-video").addEventListener("click", (e) => {
      e.stopPropagation();
      startVideoCaptureFlow(appendToBatch);
    });
    activeTopBar.querySelector("#mvl-top-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      cleanupOverlay();
      if (appendToBatch && activePopover) {
        activePopover.style.display = "block";
      } else {
        updateFloatingPill();
      }
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
      if (dimsEl) dimsEl.textContent = `${w} × ${h}`;
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

      if (pinsLayer) pinsLayer.style.display = "none";
      await new Promise((r) => setTimeout(r, 40));
      const croppedDataUrl = await captureAndCropRect(cropRect);
      if (pinsLayer) pinsLayer.style.display = "block";

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
        comment: "",
      });
    }

    activeOverlay.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp, { once: true });
  }

  async function startVideoCaptureFlow(appendToBatch = false) {
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
            comment: "",
          });
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      activeTopBar = document.createElement("div");
      activeTopBar.className = "mvl-fb-top-bar";
      activeTopBar.innerHTML = `
        <span class="mvl-fb-top-hint">${ICONS.video} <span>Recording screen...</span></span>
        <button type="button" id="mvl-stop-video" class="active">Stop & Comment</button>
      `;
      document.body.appendChild(activeTopBar);
      activeTopBar.querySelector("#mvl-stop-video").addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      });
    } catch {
      if (appendToBatch && activePopover) {
        activePopover.style.display = "block";
      } else {
        updateFloatingPill();
      }
    }
  }

  function openFeedbackPopover(newItem) {
    if (newItem) {
      if (!newItem.pageUrl) newItem.pageUrl = window.location.href;
      batchItems.push(newItem);
      activeItemIndex = batchItems.length - 1;
    }
    if (!batchItems.length) return;

    if (activePopover) {
      activePopover.remove();
      activePopover = null;
    }

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

    const selectedMode = currentConfig.mode || "qa";
    let selectedEnv = detected.env || "DEV-ONL";
    let selectedProjectId = detected.projectId;
    let selectedModuleId = detected.moduleId;
    let selectedPriority = currentConfig.defaultPriority || "medium";

    activePopover = document.createElement("div");
    activePopover.className = "mvl-fb-popover";
    activePopover.id = "mvl-fb-popover";
    activePopover.setAttribute("role", "dialog");
    activePopover.setAttribute("aria-modal", "true");
    activePopover.setAttribute("aria-label", "SnapUI Feedback Popover");

    const anchorRect = batchItems[activeItemIndex].cropRect || { x: 100, y: 100, width: 200, height: 100 };
    const popWidth = 332;
    const popHeight = 350;
    const maxCropRight = Math.max(
      ...batchItems.map((it) => (it.cropRect?.x || 100) + (it.cropRect?.width || 200))
    );
    let left = (batchItems.length > 1 ? maxCropRight : anchorRect.x + anchorRect.width) + 16;
    if (left + popWidth > window.innerWidth - 14) {
      left = Math.max(14, window.innerWidth - popWidth - 16);
    }
    if (left < 14) left = Math.max(14, Math.min(anchorRect.x, window.innerWidth - popWidth - 14));
    let top = Math.min(Math.max(14, anchorRect.y), Math.max(14, window.innerHeight - popHeight - 16));

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

    function syncCurrentCommentFromDom() {
      const el = activePopover?.querySelector("#mvl-pop-comment");
      if (el && batchItems[activeItemIndex]) {
        batchItems[activeItemIndex].comment = el.value;
      }
    }

    function renderPopoverContent() {
      renderOnPagePins();
      const isQa = selectedMode === "qa";
      const enabledProjects = getEnabledProjects();
      const modules = getModulesForProject(selectedProjectId);
      const currentItem = batchItems[activeItemIndex] || batchItems[0];
      const currentItemUrl = currentItem.pageUrl || pageUrl;
      const fp = currentItem.fingerprint || {};
      const rawComp = fp.reactComponent || "";
      const isMinifiedComp = rawComp && (/^[a-zA-Z0-9_$]{1,2}(\s*<\s*[a-zA-Z0-9_$]{1,2})*$/.test(rawComp) || rawComp.includes(" < "));
      const compLabel = (!isMinifiedComp && rawComp) || fp.domSelector || "UI Region";

      const filmstripHtml = batchItems
        .map((it, idx) => {
          const isActive = idx === activeItemIndex;
          const hasNote = Boolean((it.comment || "").trim());
          const delBtn =
            batchItems.length > 1
              ? `<button type="button" class="mvl-fb-film-del" data-del-idx="${idx}" title="Remove crop #${idx + 1}" aria-label="Remove crop ${idx + 1}">×</button>`
              : "";
          return `
            <div class="mvl-fb-film-item ${isActive ? "active" : ""} ${isQa ? "qa" : ""} ${hasNote ? "has-note" : ""}" data-idx="${idx}" role="tab" aria-selected="${isActive}" title="Crop #${idx + 1}${it.comment ? ": " + it.comment : ""}">
              <img src="${it.mediaDataUrl}" alt="Crop ${idx + 1}" />
              <span class="mvl-fb-film-idx">${idx + 1}</span>
              ${hasNote ? `<span class="mvl-fb-film-check" title="Comment added">${ICONS.check}</span>` : ""}
              ${delBtn}
            </div>
          `;
        })
        .join("");

      const batchNotesHtml =
        batchItems.length > 1
          ? `<div class="mvl-fb-batch-notes">
              ${batchItems
                .map(
                  (it, idx) => `
                  <div class="mvl-fb-note-chip ${idx === activeItemIndex ? "active" : ""}" data-chip-idx="${idx}">
                    <span class="mvl-fb-note-chip-text"><strong>#${idx + 1}</strong> ${
                      it.comment ? escapeHtml(it.comment) : "<em>Add note...</em>"
                    }</span>
                    <span>${it.cropRect.width}×${it.cropRect.height}</span>
                  </div>
                `
                )
                .join("")}
            </div>`
          : "";

      const countSuffix = batchItems.length > 1 ? ` (${batchItems.length})` : "";

      activePopover.innerHTML = `
        <div class="mvl-fb-compact-head">
          <div class="mvl-fb-filmstrip" role="tablist" aria-label="Captured crops">
            ${filmstripHtml}
            ${
              batchItems.length < MAX_SHOTS
                ? `<button type="button" class="mvl-fb-film-add" id="mvl-pop-add-crop" title="Crop another area (max ${MAX_SHOTS})">
                    ${ICONS.plus}
                    <span>Crop</span>
                  </button>`
                : ""
            }
          </div>
          <div class="mvl-fb-head-right">
            <span class="mvl-fb-slackbot-badge" id="mvl-pop-slackbot-badge" title="AI Slackbot Engine Connected (50,404 RAG chunks · Auto-Enrich)">
              ${ICONS.bot}
              <span>AI Slackbot</span>
            </span>
            <span class="mvl-fb-env-badge ${escapeHtml(selectedEnv)}" id="mvl-pop-env-badge" title="Switch environment">${escapeHtml(selectedEnv)}</span>
            <button type="button" class="mvl-fb-icon-close" id="mvl-pop-close-x" title="Close">${ICONS.close}</button>
          </div>
        </div>

        <div class="mvl-fb-url-bar" id="mvl-pop-url-bar" title="Current Page URL (Click to copy): ${escapeHtml(currentItemUrl)}">
          <span class="mvl-fb-url-icon">${ICONS.link}</span>
          <span class="mvl-fb-url-text" id="mvl-pop-url-text">${escapeHtml(currentItemUrl)}</span>
          <button type="button" class="mvl-fb-url-copy-btn" id="mvl-pop-copy-url" title="Copy URL" aria-label="Copy page URL">
            ${ICONS.copy}
          </button>
        </div>

        <div class="mvl-fb-submeta">
          <div class="mvl-fb-submeta-left">
            <code class="mvl-fb-meta-selector" title="${escapeHtml(compLabel)}">#${activeItemIndex + 1} ${escapeHtml(compLabel)}</code>
            <span class="mvl-fb-dim-pill">${currentItem.cropRect.width}×${currentItem.cropRect.height}</span>
          </div>
          <button type="button" class="mvl-fb-add-note-btn" id="mvl-pop-add-note" title="Add another comment item on this screen">+ Note</button>
        </div>

        ${batchNotesHtml}

        <div class="mvl-fb-textarea-wrap">
          <textarea
            id="mvl-pop-comment"
            class="mvl-fb-textarea"
            placeholder="${
              batchItems.length > 1
                ? `Comment for #${activeItemIndex + 1}...`
                : isQa
                ? "Describe the issue..."
                : "Describe UI change for AI..."
            }"
          >${escapeHtml(currentItem.comment || "")}</textarea>
          <span class="mvl-fb-kbd-hint">⌘↵</span>
        </div>

        <div class="mvl-fb-qa-row" style="display: ${isQa ? "grid" : "none"};">
          <select id="mvl-pop-project" title="Project">
            ${enabledProjects
              .map(
                (p) =>
                  `<option value="${escapeHtml(p.id)}" data-code="${escapeHtml(p.identifier)}" ${
                    p.id === selectedProjectId ? "selected" : ""
                  }>[${escapeHtml(p.identifier)}] ${escapeHtml(p.name)}</option>`
              )
              .join("")}
          </select>
          <select id="mvl-pop-module" title="Module">
            <option value="">No Module</option>
            ${modules
              .map(
                (m) =>
                  `<option value="${escapeHtml(m.id)}" data-name="${escapeHtml(m.name)}" ${
                    m.id === selectedModuleId ? "selected" : ""
                  }>${escapeHtml(m.name)}</option>`
              )
              .join("")}
          </select>
          <select id="mvl-pop-priority" title="Priority">
            <option value="urgent" ${selectedPriority === "urgent" ? "selected" : ""}>Urgent</option>
            <option value="high" ${selectedPriority === "high" ? "selected" : ""}>High</option>
            <option value="medium" ${selectedPriority === "medium" ? "selected" : ""}>Medium</option>
            <option value="low" ${selectedPriority === "low" ? "selected" : ""}>Low</option>
          </select>
        </div>

        <div class="mvl-fb-actions">
          <span class="mvl-fb-mode-indicator" title="Uses AI Slackbot MCP (50,404 RAG chunks) to auto-detect SRS, Route & Code">
            <span class="mvl-fb-mode-dot ${isQa ? "qa" : "dev"}"></span>
            <span>${isQa ? `QA · AI Slackbot → Plane` : "DEV · AI MCP"}</span>
          </span>
          <div class="mvl-fb-btn-group">
            <button type="button" class="mvl-fb-btn-cancel" id="mvl-pop-cancel">Cancel</button>
            <button type="button" class="mvl-fb-btn-submit ${isQa ? "qa" : ""}" id="mvl-pop-submit">
              ${ICONS.send}
              <span>${isQa ? `Create${countSuffix}` : `Send${countSuffix}`}</span>
            </button>
          </div>
        </div>
      `;

      // Filmstrip item selection
      activePopover.querySelectorAll(".mvl-fb-film-item").forEach((el) => {
        el.addEventListener("click", (ev) => {
          if (ev.target.closest(".mvl-fb-film-del")) return;
          syncCurrentCommentFromDom();
          activeItemIndex = Number(el.getAttribute("data-idx")) || 0;
          renderPopoverContent();
        });
      });

      // Filmstrip item delete
      activePopover.querySelectorAll(".mvl-fb-film-del").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          syncCurrentCommentFromDom();
          const delIdx = Number(btn.getAttribute("data-del-idx"));
          if (batchItems.length > 1) {
            batchItems.splice(delIdx, 1);
            activeItemIndex = Math.max(0, Math.min(activeItemIndex, batchItems.length - 1));
            renderPopoverContent();
          }
        });
      });

      // Chip selection
      activePopover.querySelectorAll(".mvl-fb-note-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          syncCurrentCommentFromDom();
          activeItemIndex = Number(chip.getAttribute("data-chip-idx")) || 0;
          renderPopoverContent();
        });
      });

      // "+ Crop" button -> save current note and start another crop into the same batch
      const addCropBtn = activePopover.querySelector("#mvl-pop-add-crop");
      if (addCropBtn) {
        addCropBtn.addEventListener("click", () => {
          syncCurrentCommentFromDom();
          startCaptureFlow("crop", true);
        });
      }

      // "+ Note" button -> clone current crop context to add another comment point quickly
      const addNoteBtn = activePopover.querySelector("#mvl-pop-add-note");
      if (addNoteBtn) {
        addNoteBtn.addEventListener("click", () => {
          syncCurrentCommentFromDom();
          batchItems.push({
            mediaType: currentItem.mediaType,
            mediaDataUrl: currentItem.mediaDataUrl,
            cropRect: Object.assign({}, currentItem.cropRect),
            fingerprint: Object.assign({}, currentItem.fingerprint),
            pageUrl: currentItem.pageUrl || window.location.href,
            comment: "",
          });
          activeItemIndex = batchItems.length - 1;
          renderPopoverContent();
        });
      }

      const urlBar = activePopover.querySelector("#mvl-pop-url-bar");
      const urlCopyBtn = activePopover.querySelector("#mvl-pop-copy-url");
      const urlTextEl = activePopover.querySelector("#mvl-pop-url-text");
      const copyUrlHandler = async (ev) => {
        if (ev) ev.stopPropagation();
        const textToCopy = currentItemUrl || pageUrl || window.location.href;
        const showSuccess = () => {
          if (urlCopyBtn) {
            urlCopyBtn.innerHTML = ICONS.check;
            urlCopyBtn.classList.add("copied");
          }
          if (urlTextEl) {
            const orig = urlTextEl.textContent;
            urlTextEl.textContent = "Copied URL!";
            setTimeout(() => {
              urlTextEl.textContent = orig;
            }, 1200);
          }
          setTimeout(() => {
            if (urlCopyBtn) {
              urlCopyBtn.innerHTML = ICONS.copy;
              urlCopyBtn.classList.remove("copied");
            }
          }, 1500);
        };

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(textToCopy);
            showSuccess();
          } else {
            fallbackCopyText(textToCopy);
            showSuccess();
          }
        } catch (_) {
          fallbackCopyText(textToCopy);
          showSuccess();
        }
      };

      function fallbackCopyText(text) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          ta.remove();
        } catch (_) {}
      }

      if (urlCopyBtn) {
        urlCopyBtn.addEventListener("click", copyUrlHandler);
      }
      if (urlBar) {
        urlBar.addEventListener("click", (ev) => {
          if (!ev.target.closest("#mvl-pop-copy-url")) {
            copyUrlHandler(ev);
          }
        });
      }

      const closeX = activePopover.querySelector("#mvl-pop-close-x");
      if (closeX) closeX.addEventListener("click", () => closePopover(true));

      activePopover.querySelector("#mvl-pop-env-badge").addEventListener("click", () => {
        syncCurrentCommentFromDom();
        const order = ["DEV-ONL", "PROD", "LOCAL"];
        selectedEnv = order[(order.indexOf(selectedEnv) + 1) % order.length];
        renderPopoverContent();
      });

      const projSelect = activePopover.querySelector("#mvl-pop-project");
      if (projSelect) {
        projSelect.addEventListener("change", async (e) => {
          syncCurrentCommentFromDom();
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

      const prioSelect = activePopover.querySelector("#mvl-pop-priority");
      if (prioSelect) {
        prioSelect.addEventListener("change", (e) => {
          selectedPriority = e.target.value || "medium";
        });
      }

      activePopover.querySelector("#mvl-pop-cancel").addEventListener("click", () => {
        closePopover(true);
      });

      const commentInput = activePopover.querySelector("#mvl-pop-comment");
      const submitBtn = activePopover.querySelector("#mvl-pop-submit");

      commentInput.focus();
      commentInput.setSelectionRange(commentInput.value.length, commentInput.value.length);
      commentInput.addEventListener("input", () => {
        document.querySelectorAll(".mvl-fb-toast").forEach((t) => t.remove());
        commentInput.style.borderColor = "";
        if (batchItems[activeItemIndex]) {
          batchItems[activeItemIndex].comment = commentInput.value;
          const activeChipText = activePopover.querySelector(
            `.mvl-fb-note-chip[data-chip-idx="${activeItemIndex}"] .mvl-fb-note-chip-text`
          );
          if (activeChipText) {
            activeChipText.innerHTML = `<strong>#${activeItemIndex + 1}</strong> ${
              commentInput.value ? escapeHtml(commentInput.value) : "<em>Add note...</em>"
            }`;
          }
          const activePinBubble = pinsLayer?.querySelector(
            `.mvl-fb-pin-bubble[data-pin-bubble-idx="${activeItemIndex}"]`
          );
          if (activePinBubble) {
            const val = (commentInput.value || "").trim();
            activePinBubble.innerHTML = val ? escapeHtml(val) : "<em>Typing comment...</em>";
          }
        }
      });

      commentInput.addEventListener("keydown", (ev) => {
        if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
          ev.preventDefault();
          submitBtn.click();
        } else if (ev.key === "Escape") {
          closePopover(true);
        }
      });

      submitBtn.addEventListener("click", async () => {
        syncCurrentCommentFromDom();
        // Validation: Ensure every crop item has a comment
        const missingIndex = batchItems.findIndex((it) => !(it.comment || "").trim());
        if (missingIndex !== -1) {
          activeItemIndex = missingIndex;
          renderPopoverContent();
          const commentEl = activePopover.querySelector("#mvl-pop-comment");
          if (commentEl) {
            commentEl.style.borderColor = "#ef4444";
            commentEl.focus();
          }
          showToast(`Please add a comment for crop #${missingIndex + 1}`, true);
          return;
        }

        const combinedComment = batchItems.length > 1
          ? batchItems.map((it, idx) => `#${idx + 1}: ${(it.comment || "").trim()}`).join("\n\n")
          : (batchItems[0]?.comment || "").trim();

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>${isQa ? "AI Detecting..." : "Sending..."}</span>`;

        const allProjects = getEnabledProjects();
        const projObj = allProjects.find((p) => p.id === selectedProjectId) || allProjects[0];
        const mods = getModulesForProject(selectedProjectId);
        const modObj = mods.find((m) => m.id === selectedModuleId);

        const primaryItem = batchItems[0];
        const payload = {
          mode: selectedMode,
          env: selectedEnv,
          pageUrl,
          comment: combinedComment,
          mediaType: primaryItem.mediaType,
          mediaDataUrl: primaryItem.mediaDataUrl,
          cropRect: primaryItem.cropRect,
          fingerprint: primaryItem.fingerprint,
          batch: batchItems.length,
          items: batchItems.map((it, idx) => ({
            index: idx + 1,
            comment: (it.comment || "").trim(),
            pageUrl: it.pageUrl || pageUrl,
            mediaType: it.mediaType,
            mediaDataUrl: it.mediaDataUrl,
            cropRect: it.cropRect,
            fingerprint: it.fingerprint,
          })),
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
          submitBtn.innerHTML = `${ICONS.send} <span>Retry</span>`;
          showToast(`Error: ${result?.error || "Connection failed"}`, true);
          return;
        }

        const totalSent = batchItems.length;
        const issueKey = result.planeIssue?.identifier || result.id || "";
        const pinRectCounts = {};
        batchItems.forEach((it, idx) => {
          const r = it.cropRect || { x: 80, y: 80, width: 160, height: 80 };
          const rKey = `${r.x}_${r.y}_${r.width}_${r.height}`;
          const pOffset = pinRectCounts[rKey] || 0;
          pinRectCounts[rKey] = pOffset + 1;
          submittedPins.push({
            index: idx + 1,
            issueKey,
            comment: (it.comment || "").trim(),
            cropRect: Object.assign({}, r),
            pinOffset: pOffset,
          });
        });
        closePopover(true);
        if (selectedMode === "qa" && result.planeIssue) {
          const aiDoc = result.aiSlackbot?.route_info?.srs_doc || result.aiSlackbot?.route_info?.screen_name || "SRS & Code";
          showToast(
            `<div style="font-weight:600;margin-bottom:2px;">Created Plane Issue (${totalSent} item${totalSent > 1 ? "s" : ""}): <a href="${result.planeIssue.url}" target="_blank">${result.planeIssue.identifier}</a></div><div style="font-size:11px;color:#64748b;">AI Slackbot detected: <code>${escapeHtml(String(aiDoc).slice(0, 42))}</code> · R2 & MCP synced</div>`
          );
        } else {
          showToast(
            `<div style="font-weight:600;margin-bottom:2px;">Sent ${totalSent} item${totalSent > 1 ? "s" : ""} to MCP · <code style="color:#2563eb;">${result.id}</code></div><div style="font-size:11px;color:#64748b;">Ask AI: "Fix latest UI feedback (${result.id})"</div>`
          );
        }
      });

      const popRect = activePopover.getBoundingClientRect();
      if (popRect.bottom > window.innerHeight - 12) {
        activePopover.style.top = `${Math.max(12, window.innerHeight - popRect.height - 12)}px`;
      }
      if (popRect.right > window.innerWidth - 12) {
        activePopover.style.left = `${Math.max(12, window.innerWidth - popRect.width - 12)}px`;
      }
    }

    document.body.appendChild(activePopover);
    renderPopoverContent();
  }

  function showToast(htmlContent, isError = false) {
    document.querySelectorAll(".mvl-fb-toast").forEach((t) => t.remove());
    const toast = document.createElement("div");
    toast.className = "mvl-fb-toast";
    if (isError) toast.style.borderColor = "#fecdd3";
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
          startCaptureFlow(msg.captureType || "crop", false);
          sendResponse({ ok: true });
        });
        return true;
      }
      if (msg?.type === "MVL_CONFIG_UPDATED") {
        loadConfig().then(() => sendResponse({ ok: true }));
        return true;
      }
      return false;
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.shiftKey && e.code === "KeyC") {
      e.preventDefault();
      loadConfig().then(() => startCaptureFlow("crop", Boolean(activePopover)));
    } else if (e.key === "Escape" && (activeOverlay || activeTopBar)) {
      cleanupOverlay();
      if (activePopover) {
        activePopover.style.display = "block";
      } else {
        updateFloatingPill();
      }
    }
  });

  injectPageBridge();
  loadConfig().then(() => {
    createFloatingPill();
  });
})();
