/**
 * Popup Logic for MVL UI Feedback Extension (v1.1 Design System)
 * - Switches between DEV Mode (MCP Queue) and QA Mode (Plane Task via PAT)
 * - Auto-detects Project & Module from active tab URL (Production / Dev Online / Localhost)
 * - Allows configuring & syncing Plane PAT (pre-filled with connected PAT)
 * - Renders interactive Project Filter Chips & rich History Cards with R2 Crop Thumbnails
 */

(function () {
  let config = Object.assign({}, window.MVL_DEFAULT_CONFIG || {});
  let activeTabUrl = "";

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

  function setStatus(text, isError = false) {
    statusMsg.textContent = text;
    statusMsg.style.color = isError ? "#e11d48" : "#059669";
    if (text) {
      setTimeout(() => {
        if (statusMsg.textContent === text) statusMsg.textContent = "";
      }, 3200);
    }
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
    btnModeDev.className = `role-pill ${!isQa ? "active" : ""}`;
    btnModeQa.className = `role-pill ${isQa ? "active" : ""}`;
    btnStartCrop.className = `btn-capture-primary ${isQa ? "qa" : ""}`;
    if (btnStartCropLabel) {
      btnStartCropLabel.textContent = isQa
        ? "Crop & Create Issue"
        : "Crop & Send to MCP";
    }
  }

  function getEnabledProjects() {
    const all = config.projects || window.MVL_DEFAULT_CONFIG.projects || [];
    const enabled = config.enabledProjectCodes || [];
    if (!enabled.length) return all;
    const list = all.filter((p) => enabled.includes(p.identifier));
    return list.length ? list : all;
  }

  function renderProjectDropdowns(detected) {
    const enabledProjects = getEnabledProjects();
    const targetProjectId = detected?.projectId || config.defaultProjectId;

    selectDefaultProject.innerHTML = enabledProjects
      .map(
        (p) =>
          `<option value="${escapeHtml(p.id)}" data-code="${escapeHtml(p.identifier)}" ${
            p.id === targetProjectId ? "selected" : ""
          }>[${escapeHtml(p.identifier)}] ${escapeHtml(p.name)}</option>`
      )
      .join("");

    renderModuleDropdown(targetProjectId, detected?.moduleId || config.defaultModuleId);
  }

  function renderModuleDropdown(projectId, selectedModuleId) {
    const mods = (config.modulesByProject && config.modulesByProject[projectId]) || [];
    selectDefaultModule.innerHTML =
      `<option value="">-- Không gắn Module --</option>` +
      mods
        .map(
          (m) =>
            `<option value="${escapeHtml(m.id)}" data-name="${escapeHtml(m.name)}" ${
              m.id === selectedModuleId ? "selected" : ""
            }>${escapeHtml(m.name)}</option>`
        )
        .join("");
  }

  function renderProjectChecklist() {
    const all = config.projects || window.MVL_DEFAULT_CONFIG.projects || [];
    const enabled = new Set(config.enabledProjectCodes || []);
    projectChecklist.innerHTML = all
      .map((p) => {
        const isChecked = enabled.has(p.identifier);
        return `
          <label class="project-check-item ${isChecked ? "checked" : ""}" title="${escapeHtml(p.name)}">
            <div class="project-code-label">
              <strong>${escapeHtml(p.identifier)}</strong>
              <span class="project-code-sub">${escapeHtml(p.name)}</span>
            </div>
            <input type="checkbox" value="${escapeHtml(p.identifier)}" ${isChecked ? "checked" : ""} />
          </label>
        `;
      })
      .join("");

    projectChecklist.querySelectorAll("input[type='checkbox']").forEach((chk) => {
      chk.addEventListener("change", () => {
        const label = chk.closest(".project-check-item");
        if (label) label.classList.toggle("checked", chk.checked);
        const checkedCodes = Array.from(
          projectChecklist.querySelectorAll("input[type='checkbox']:checked")
        ).map((el) => el.value);
        saveConfig({ enabledProjectCodes: checkedCodes });
        const detected = window.detectMvlContextFromUrl(activeTabUrl, config);
        renderProjectDropdowns(detected);
        setStatus("Đã lưu bộ lọc Project");
      });
    });
  }

  function renderAccountAndPat() {
    inputPlanePat.value = config.planePat || "DEFAULT_CONNECTED_ACCOUNT";
    inputPlaneHost.value = config.planeHostUrl || "https://pm.glinteco.com";
    inputPlaneWorkspace.value = config.planeWorkspaceSlug || "glinteco";
    inputMcpUrl.value =
      config.mcpEndpointUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp";
    chkFloatingPill.checked = config.showFloatingButton !== false;

    const u = config.planeUser || {};
    const fullName = u.first_name || u.display_name || "Pham Hung";
    accountNameText.textContent = `${fullName} (${u.display_name || "hung.phamduc"})`;
    accountEmailText.textContent = `${
      u.email || "hung.phamduc@glinteco.com"
    } • PAT đã gắn sẵn`;
    if (accountAvatarInitials) {
      const initials = fullName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      accountAvatarInitials.textContent = initials || "PH";
    }
  }

  function renderAll() {
    renderModeButtons();
    const detected = window.detectMvlContextFromUrl(activeTabUrl, config);
    detectedEnvPill.textContent = detected.env;
    detectedEnvPill.className = `env-pill ${detected.env}`;
    detectedUrlText.textContent = activeTabUrl;

    renderProjectDropdowns(detected);
    renderProjectChecklist();
    renderAccountAndPat();
  }

  // Event Listeners
  btnModeDev.addEventListener("click", () => {
    saveConfig({ mode: "dev" });
    renderModeButtons();
    setStatus("DEV Mode → Đẩy thẳng vào MCP");
  });

  btnModeQa.addEventListener("click", () => {
    saveConfig({ mode: "qa" });
    renderModeButtons();
    setStatus("QA Mode → Tạo Task lên Plane");
  });

  selectDefaultProject.addEventListener("change", (e) => {
    const pid = e.target.value;
    const code = e.target.selectedOptions[0]?.getAttribute("data-code") || "MVLCTV";
    const mods = (config.modulesByProject && config.modulesByProject[pid]) || [];
    const firstMod = mods[0] || null;
    saveConfig({
      defaultProjectId: pid,
      defaultProjectCode: code,
      defaultModuleId: firstMod ? firstMod.id : "",
      defaultModuleName: firstMod ? firstMod.name : "",
    });
    renderModuleDropdown(pid, firstMod ? firstMod.id : "");
    setStatus(`Đã chọn [${code}]`);
  });

  selectDefaultModule.addEventListener("change", (e) => {
    const mid = e.target.value;
    const mname = e.target.selectedOptions[0]?.getAttribute("data-name") || "";
    saveConfig({ defaultModuleId: mid, defaultModuleName: mname });
    setStatus(`Module: ${mname || "Không gắn"}`);
  });

  btnSelectAllProjects.addEventListener("click", () => {
    const allCodes = (config.projects || []).map((p) => p.identifier);
    saveConfig({ enabledProjectCodes: allCodes });
    renderProjectChecklist();
    const detected = window.detectMvlContextFromUrl(activeTabUrl, config);
    renderProjectDropdowns(detected);
    setStatus("Đã bật tất cả Project");
  });

  const btnToggleAddProject = document.getElementById("btn-toggle-add-project");
  const addProjectDrawer = document.getElementById("add-project-drawer");
  const btnSaveNewProject = document.getElementById("btn-save-new-project");
  if (btnToggleAddProject && addProjectDrawer) {
    btnToggleAddProject.addEventListener("click", () => {
      const isHidden = addProjectDrawer.style.display === "none";
      addProjectDrawer.style.display = isHidden ? "flex" : "none";
    });
  }
  if (btnSaveNewProject) {
    btnSaveNewProject.addEventListener("click", () => {
      const codeEl = document.getElementById("input-new-proj-code");
      const nameEl = document.getElementById("input-new-proj-name");
      const idEl = document.getElementById("input-new-proj-id");
      const code = (codeEl?.value || "").trim().toUpperCase();
      const name = (nameEl?.value || "").trim();
      const id = (idEl?.value || "").trim() || `custom-${code.toLowerCase()}-${Date.now()}`;
      if (!code || !name) {
        setStatus("Nhập Mã & Tên Project", true);
        return;
      }
      const existing = config.projects || [];
      const updatedProjects = [{ id, identifier: code, name }, ...existing.filter((p) => p.identifier !== code)];
      const updatedEnabled = Array.from(new Set([code, ...(config.enabledProjectCodes || [])]));
      saveConfig({ projects: updatedProjects, enabledProjectCodes: updatedEnabled, defaultProjectId: id, defaultProjectCode: code });
      renderAll();
      if (addProjectDrawer) addProjectDrawer.style.display = "none";
      if (codeEl) codeEl.value = "";
      if (nameEl) nameEl.value = "";
      if (idEl) idEl.value = "";
      setStatus(`Đã thêm [${code}]`);
    });
  }

  btnStartCrop.addEventListener("click", async () => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "MVL_START_CAPTURE", captureType: "crop", mode: config.mode },
          () => {
            window.close();
          }
        );
      }
    }
  });

  btnStartVideo.addEventListener("click", async () => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "MVL_START_CAPTURE", captureType: "video", mode: config.mode },
          () => {
            window.close();
          }
        );
      }
    }
  });

  btnSyncPlane.addEventListener("click", async () => {
    const pat = inputPlanePat.value.trim();
    const hostUrl = inputPlaneHost.value.trim() || "https://pm.glinteco.com";
    const workspaceSlug = inputPlaneWorkspace.value.trim() || "glinteco";
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
    await navigator.clipboard.writeText(mcpJson);
    setStatus("Đã copy cấu hình MCP!");
  });

  chkFloatingPill.addEventListener("change", (e) => {
    saveConfig({ showFloatingButton: e.target.checked });
  });

  async function loadHistory() {
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
          const badge = isQa
            ? `<a href="${escapeHtml(it.plane_task.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.plane_task.identifier)} · ${escapeHtml(
                it.plane_task.module_name || it.plane_task.project_code || ""
              )}</a>`
            : `MCP · ${escapeHtml(it.id)}`;
          const thumbHtml = it.media_url
            ? `<img class="history-thumb" src="${escapeHtml(it.media_url)}" alt="Crop" loading="lazy" />`
            : "";
          return `
            <div class="history-item">
              ${thumbHtml}
              <div class="history-body">
                <div class="history-top">
                  <span class="history-id">${badge}</span>
                  <span class="env-pill ${escapeHtml(it.env)}">${escapeHtml(it.env)}</span>
                </div>
                <div class="history-comment">${escapeHtml(it.comment)}</div>
                <div class="history-meta">
                  <span>${escapeHtml(it.pathname || it.page_url || "")}</span>
                  ${
                    it.media_url
                      ? `<a href="${escapeHtml(it.media_url)}" target="_blank" rel="noopener noreferrer">Ảnh R2 ↗</a>`
                      : ""
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    } catch (err) {
      historyList.innerHTML = `<div class="empty-state">Không tải được lịch sử: ${err.message}</div>`;
    }
  }

  btnRefreshHistory.addEventListener("click", loadHistory);

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.getAttribute("data-tab"));
      if (target) target.classList.add("active");
      if (btn.getAttribute("data-tab") === "tab-history") {
        loadHistory();
      }
    });
  });

  loadStoredConfig();
})();
