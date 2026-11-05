/**
 * MVL UI Feedback v2.0 — Popup Logic (Universal FE/QA)
 * - DEV Mode: DOM Telemetry & Screenshot to Cloudflare Remote MCP
 * - QA Mode: Plane Task Creation via PAT + Cloudflare R2 Media
 * - Full WAI-ARIA Accessibility (radiogroup, tabs, arrow navigation, focus visibility)
 * - P0 Security: Complete HTML entity escaping across all dynamic fields
 */

(function () {
  let config = Object.assign({}, window.MVL_DEFAULT_CONFIG || {});
  let activeTabUrl = "";

  // DOM Elements
  const btnModeDev = document.getElementById("btn-mode-dev");
  const btnModeQa = document.getElementById("btn-mode-qa");
  const btnStartCrop = document.getElementById("btn-start-crop");
  const btnStartCropLabel = document.getElementById("btn-start-crop-label");
  const btnStartVideo = document.getElementById("btn-start-video");
  const selectDefaultProject = document.getElementById("select-default-project");
  const selectDefaultModule = document.getElementById("select-default-module");
  const projectChecklist = document.getElementById("project-checklist");
  const btnSelectAllProjects = document.getElementById("btn-select-all-projects");
  const detectedEnvPill = document.getElementById("detected-env-pill");
  const detectedUrlText = document.getElementById("detected-url-text");
  const inputPlanePat = document.getElementById("input-plane-pat");
  const inputPlaneHost = document.getElementById("input-plane-host");
  const inputPlaneWorkspace = document.getElementById("input-plane-workspace");
  const btnSyncPlane = document.getElementById("btn-sync-plane");
  const btnSyncPlaneLabel = document.getElementById("btn-sync-plane-label");
  const accountNameText = document.getElementById("account-name-text");
  const accountEmailText = document.getElementById("account-email-text");
  const accountAvatarInitials = document.getElementById("account-avatar-initials");
  const inputMcpUrl = document.getElementById("input-mcp-url");
  const btnCopyMcp = document.getElementById("btn-copy-mcp");
  const historyList = document.getElementById("history-list");
  const btnRefreshHistory = document.getElementById("btn-refresh-history");
  const chkFloatingPill = document.getElementById("chk-floating-pill");
  const statusMsg = document.getElementById("status-msg");

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

  function setStatus(text, isError = false) {
    if (!statusMsg) return;
    statusMsg.textContent = text;
    statusMsg.style.color = isError ? "var(--accent-red)" : "var(--accent-qa)";
    if (text) {
      setTimeout(() => {
        if (statusMsg.textContent === text) statusMsg.textContent = "";
      }, 3500);
    }
  }

  async function loadStoredConfig() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(["mvlConfig"]);
      if (stored && stored.mvlConfig) {
        config = Object.assign({}, window.MVL_DEFAULT_CONFIG, stored.mvlConfig);
      }
    }
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTabUrl = tab?.url || "https://host-app-production.up.railway.app/appsale";
    } else {
      activeTabUrl = window.location.href;
    }
    renderAll();
  }

  async function saveConfig(patch = {}) {
    config = Object.assign({}, config, patch);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ mvlConfig: config });
    }
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "MVL_CONFIG_UPDATED" }, () => {
          void chrome.runtime.lastError;
        });
      }
    }
  }

  function renderModeButtons() {
    const isQa = (config.mode || "qa") === "qa";
    if (btnModeDev) {
      btnModeDev.className = `mode-card ${!isQa ? "active-dev" : ""}`;
      btnModeDev.setAttribute("aria-checked", !isQa ? "true" : "false");
      btnModeDev.tabIndex = !isQa ? 0 : -1;
    }

    if (btnModeQa) {
      btnModeQa.className = `mode-card ${isQa ? "active-qa" : ""}`;
      btnModeQa.setAttribute("aria-checked", isQa ? "true" : "false");
      btnModeQa.tabIndex = isQa ? 0 : -1;
    }

    if (btnStartCrop) {
      btnStartCrop.className = `btn-capture-primary ${isQa ? "qa" : ""}`;
    }
    if (btnStartCropLabel) {
      btnStartCropLabel.textContent = isQa
        ? "Chụp Ảnh Crop → Tạo Task Plane"
        : "Chụp Ảnh Crop → Gửi Cho AI";
    }
  }

  function setMode(newMode) {
    if (config.mode === newMode) return;
    saveConfig({ mode: newMode });
    renderModeButtons();
    setStatus(`Đã chuyển sang ${newMode === "qa" ? "QA Mode (Plane)" : "DEV Mode (AI MCP)"}`);
  }

  function getEnabledProjects() {
    const all = config.projects || window.MVL_DEFAULT_CONFIG.projects || [];
    const enabled = config.enabledProjectCodes || [];
    if (!enabled.length) return all;
    const list = all.filter((p) => enabled.includes(p.identifier));
    return list.length ? list : all;
  }

  function detectEnvironmentAndProject() {
    let env = "DEV-ONLINE";
    let detectedProjCode = config.defaultProjectCode || "MVLCTV";
    let detectedModId = "";

    try {
      const u = new URL(activeTabUrl);
      const host = u.host.toLowerCase();
      const path = u.pathname.toLowerCase();

      if (host.includes("localhost") || host.includes("127.0.0.1")) {
        env = "LOCAL";
      } else if (
        host.includes("erp.minhviet.vn") ||
        host.includes("sales.minhviet.vn") ||
        host.includes("mvl.vn")
      ) {
        env = "PROD";
      } else {
        env = "DEV-ONLINE";
      }

      const all = config.projects || [];
      const match = all.find((p) => {
        const dom = (p.domains || []).map((d) => d.toLowerCase());
        const pre = (p.pathPrefixes || []).map((x) => x.toLowerCase());
        const matchDom = dom.some((d) => host.includes(d));
        const matchPath = pre.some((x) => path.startsWith(x));
        return matchDom || matchPath;
      });

      if (match) {
        detectedProjCode = match.identifier;
        const mods = config.modulesByProject?.[match.id] || [];
        const modMatch = mods.find((m) => {
          const mKeys = (m.pathKeywords || []).map((k) => k.toLowerCase());
          return mKeys.some((k) => path.includes(k));
        });
        if (modMatch) detectedModId = modMatch.id;
      }
    } catch {
      // Fallback to default
    }

    return { env, detectedProjCode, detectedModId };
  }

  function renderEnvironmentBanner() {
    const { env } = detectEnvironmentAndProject();
    if (detectedEnvPill) {
      detectedEnvPill.textContent = env;
      detectedEnvPill.className = `env-tag ${env.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    }
    if (detectedUrlText) {
      detectedUrlText.textContent = activeTabUrl;
      detectedUrlText.title = activeTabUrl;
    }
  }

  function renderProjects() {
    const enabledProjects = getEnabledProjects();
    const { detectedProjCode, detectedModId } = detectEnvironmentAndProject();

    if (selectDefaultProject) {
      selectDefaultProject.innerHTML = "";
      enabledProjects.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.identifier})`;
        if (p.identifier === detectedProjCode) opt.selected = true;
        selectDefaultProject.appendChild(opt);
      });
      renderModules(selectDefaultProject.value, detectedModId);
    }

    renderProjectChecklist();
  }

  function renderModules(projectId, preselectedId = "") {
    if (!selectDefaultModule) return;
    selectDefaultModule.innerHTML = "";
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "— Không chọn phân hệ / Mặc định —";
    selectDefaultModule.appendChild(emptyOpt);

    const mods = config.modulesByProject?.[projectId] || [];
    mods.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.id === preselectedId) opt.selected = true;
      selectDefaultModule.appendChild(opt);
    });
  }

  function renderProjectChecklist() {
    if (!projectChecklist) return;
    const all = config.projects || window.MVL_DEFAULT_CONFIG.projects || [];
    const enabled = config.enabledProjectCodes || [];
    projectChecklist.innerHTML = "";

    all.forEach((p) => {
      const isChecked = !enabled.length || enabled.includes(p.identifier);
      const chip = document.createElement("label");
      chip.className = "project-chip";

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = isChecked;
      chk.addEventListener("change", () => {
        const currentEnabled = (config.enabledProjectCodes && config.enabledProjectCodes.slice()) ||
          all.map((x) => x.identifier);
        let next;
        if (chk.checked) {
          next = Array.from(new Set([...currentEnabled, p.identifier]));
        } else {
          next = currentEnabled.filter((code) => code !== p.identifier);
        }
        saveConfig({ enabledProjectCodes: next });
        renderProjects();
      });

      const nameSpan = document.createElement("span");
      nameSpan.textContent = p.name;

      const codeSpan = document.createElement("span");
      codeSpan.className = "project-chip-code";
      codeSpan.textContent = p.identifier;

      chip.appendChild(chk);
      chip.appendChild(nameSpan);
      chip.appendChild(codeSpan);
      projectChecklist.appendChild(chip);
    });
  }

  function renderAccountBanner() {
    const user = config.planeUser || window.MVL_DEFAULT_CONFIG.planeUser || {};
    const name = user.display_name || user.first_name || "Pham Hung";
    const email = user.email || "hung.phamduc@glinteco.com";

    if (accountNameText) accountNameText.textContent = name;
    if (accountEmailText) accountEmailText.textContent = `${email} · PAT mặc định`;
    if (accountAvatarInitials) {
      accountAvatarInitials.textContent = name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    if (inputPlanePat) inputPlanePat.value = config.planePat || "";
    if (inputPlaneHost) inputPlaneHost.value = config.planeHostUrl || "https://pm.glinteco.com";
    if (inputPlaneWorkspace) inputPlaneWorkspace.value = config.planeWorkspaceSlug || "glinteco";
    if (inputMcpUrl) {
      inputMcpUrl.value =
        config.mcpEndpointUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp";
    }
    if (chkFloatingPill) {
      chkFloatingPill.checked = config.showFloatingButton !== false;
    }
  }

  function renderAll() {
    renderModeButtons();
    renderEnvironmentBanner();
    renderProjects();
    renderAccountBanner();
  }

  // Segmented Mode Navigation with Arrow Keys
  if (btnModeDev && btnModeQa) {
    btnModeDev.addEventListener("click", () => setMode("dev"));
    btnModeQa.addEventListener("click", () => setMode("qa"));

    [btnModeDev, btnModeQa].forEach((btn) => {
      btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          setMode("qa");
          btnModeQa.focus();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          setMode("dev");
          btnModeDev.focus();
        }
      });
    });
  }

  // Trigger Capture
  function triggerCapture(captureType = "crop") {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "MVL_START_CAPTURE", captureType, mode: config.mode || "qa" },
            () => {
              void chrome.runtime.lastError;
              window.close();
            }
          );
        }
      });
    }
  }

  if (btnStartCrop) {
    btnStartCrop.addEventListener("click", () => triggerCapture("crop"));
  }
  if (btnStartVideo) {
    btnStartVideo.addEventListener("click", () => triggerCapture("video"));
  }

  if (selectDefaultProject) {
    selectDefaultProject.addEventListener("change", (e) => {
      renderModules(e.target.value);
    });
  }

  if (btnSelectAllProjects) {
    btnSelectAllProjects.addEventListener("click", () => {
      const all = config.projects || window.MVL_DEFAULT_CONFIG.projects || [];
      saveConfig({ enabledProjectCodes: all.map((p) => p.identifier) });
      renderProjects();
      setStatus("Đã chọn tất cả dự án!");
    });
  }

  if (btnSyncPlane) {
    btnSyncPlane.addEventListener("click", async () => {
      const pat = (inputPlanePat ? inputPlanePat.value.trim() : "");
      const hostUrl = (inputPlaneHost ? inputPlaneHost.value.trim() : "") || "https://pm.glinteco.com";
      const workspaceSlug = (inputPlaneWorkspace ? inputPlaneWorkspace.value.trim() : "") || "glinteco";

      btnSyncPlane.disabled = true;
      if (btnSyncPlaneLabel) btnSyncPlaneLabel.textContent = "Đang đồng bộ từ Plane...";

      const workerBase = (
        config.workerBaseUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev"
      ).replace(/\/+$/, "");

      try {
        const res = await fetch(`${workerBase}/api/plane/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pat, hostUrl, workspaceSlug }),
        });
        const data = await res.json();
        if (data?.ok) {
          await saveConfig({
            planePat: pat,
            planeHostUrl: hostUrl,
            planeWorkspaceSlug: workspaceSlug,
            planeUser: data.user || config.planeUser,
            projects: data.projects || config.projects,
            modulesByProject: Object.assign(
              {},
              config.modulesByProject,
              data.modulesByProject || {}
            ),
          });
          renderAll();
          setStatus(`Đã đồng bộ ${(data.projects || []).length} Projects!`);
        } else {
          setStatus("Lỗi đồng bộ Plane PAT", true);
        }
      } catch (err) {
        setStatus(`Lỗi: ${err.message}`, true);
      } finally {
        btnSyncPlane.disabled = false;
        if (btnSyncPlaneLabel) {
          btnSyncPlaneLabel.textContent = "Lưu PAT & Đồng bộ Projects / Modules";
        }
      }
    });
  }

  if (btnCopyMcp) {
    btnCopyMcp.addEventListener("click", async () => {
      const mcpJson = JSON.stringify(
        {
          "mvl-ui-feedback-mcp": {
            serverUrl:
              config.mcpEndpointUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp",
          },
        },
        null,
        2
      );
      try {
        await navigator.clipboard.writeText(mcpJson);
        setStatus("Đã copy cấu hình MCP!");
      } catch {
        setStatus("Không thể copy vào clipboard", true);
      }
    });
  }

  if (chkFloatingPill) {
    chkFloatingPill.addEventListener("change", (e) => {
      saveConfig({ showFloatingButton: e.target.checked });
    });
  }

  /**
   * Load history from Cloudflare D1 with safe HTML rendering
   */
  async function loadHistory() {
    if (!historyList) return;
    historyList.innerHTML = `<div class="empty-state">Đang tải từ Cloudflare D1...</div>`;
    const workerBase = (
      config.workerBaseUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev"
    ).replace(/\/+$/, "");

    try {
      const res = await fetch(`${workerBase}/api/feedbacks?limit=10`);
      const data = await res.json();
      const items = data?.items || [];
      if (!items.length) {
        historyList.innerHTML = `<div class="empty-state">Chưa có feedback nào. Hãy bấm Chụp Ảnh Crop!</div>`;
        return;
      }

      historyList.innerHTML = items
        .map((it) => {
          const isQa = it.mode === "qa" && it.plane_task;
          const safeIdentifier = escapeHtml(it.plane_task?.identifier || "");
          const safeTaskUrl = escapeHtml(it.plane_task?.url || "#");
          const safeModuleName = escapeHtml(it.plane_task?.module_name || it.plane_task?.project_code || "");
          const safeId = escapeHtml(it.id || "");
          const safeEnv = escapeHtml(it.env || "");
          const safeComment = escapeHtml(it.comment || "");
          const safePath = escapeHtml(it.pathname || it.page_url || "");
          const safeMediaUrl = escapeHtml(it.media_url || "");

          const badge = isQa
            ? `<a href="${safeTaskUrl}" target="_blank" rel="noopener noreferrer">${safeIdentifier} · ${safeModuleName}</a>`
            : `MCP · ${safeId}`;

          const thumbHtml = safeMediaUrl
            ? `<img class="history-thumb" src="${safeMediaUrl}" alt="Crop Preview" loading="lazy" />`
            : "";

          return `
            <div class="history-item">
              ${thumbHtml}
              <div class="history-body">
                <div class="history-top">
                  <span class="history-id">${badge}</span>
                  <span class="env-tag ${safeEnv.toLowerCase().replace(/[^a-z0-9]/g, "-")}">${safeEnv}</span>
                </div>
                <div class="history-comment">${safeComment}</div>
                <div class="history-meta">
                  <span>${safePath}</span>
                  ${
                    safeMediaUrl
                      ? `<a href="${safeMediaUrl}" target="_blank" rel="noopener noreferrer">Ảnh R2 ↗</a>`
                      : ""
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    } catch (err) {
      historyList.innerHTML = `<div class="empty-state">Không tải được lịch sử: ${escapeHtml(err.message)}</div>`;
    }
  }

  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener("click", loadHistory);
  }

  // WAI-ARIA Tab Switching & Arrow Key Navigation
  const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
  tabButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      activateTab(btn);
    });

    btn.addEventListener("keydown", (e) => {
      let nextIndex = null;
      if (e.key === "ArrowRight") {
        nextIndex = (index + 1) % tabButtons.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
      }
      if (nextIndex !== null) {
        e.preventDefault();
        const nextBtn = tabButtons[nextIndex];
        activateTab(nextBtn);
        nextBtn.focus();
      }
    });
  });

  function activateTab(btn) {
    const tabId = btn.getAttribute("data-tab");
    tabButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
      b.tabIndex = active ? 0 : -1;
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const match = panel.id === tabId;
      panel.classList.toggle("active", match);
      if (match) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "true");
      }
    });

    if (tabId === "tab-history") {
      loadHistory();
    }
  }

  loadStoredConfig();
})();
