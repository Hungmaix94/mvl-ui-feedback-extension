/**
 * Background Service Worker for MVL UI Feedback Chrome Extension
 * - Captures 100% pixel-accurate visible tab screenshots (`chrome.tabs.captureVisibleTab`)
 * - Relays Plane sync & Feedback submission requests to Cloudflare Remote MCP Worker
 * - Handles keyboard shortcut `Alt+Shift+C`
 */

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["mvlConfig"]);
  if (!stored.mvlConfig) {
    await chrome.storage.local.set({
      mvlConfig: {
        mode: "qa",
        captureType: "crop",
        showFloatingButton: true,
        workerBaseUrl: "https://mvl-ui-feedback-mcp.warhorses94.workers.dev",
        mcpEndpointUrl: "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp",
        planeHostUrl: "https://pm.glinteco.com",
        planeWorkspaceSlug: "glinteco",
        planePat: "DEFAULT_CONNECTED_ACCOUNT",
        planeUser: {
          id: "8ad0e2eb-5ce1-40ee-aa03-a14c872922c0",
          display_name: "hung.phamduc",
          first_name: "Pham Hung",
          email: "hung.phamduc@glinteco.com",
        },
        defaultProjectId: "e92f7ba8-0db9-487f-a21c-13712d226eb8",
        defaultProjectCode: "MVLCTV",
        defaultPriority: "medium",
        enabledProjectCodes: [
          "MVLCTV",
          "MVL",
          "MVLGO",
          "MAIVIETLAN",
          "CRM",
          "FETEAMS",
          "MVL4",
          "DEVOPS",
          "DSTAX",
          "GLINTECOWEBS",
        ],
      },
    });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "start-crop-feedback") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "MVL_START_CAPTURE",
        captureType: "crop",
      });
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "MVL_CAPTURE_VISIBLE_TAB") {
    const windowId = sender?.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError?.message || "captureVisibleTab failed",
        });
      } else {
        sendResponse({ ok: true, dataUrl });
      }
    });
    return true;
  }

  if (message?.type === "MVL_SUBMIT_FEEDBACK") {
    const workerBase = (
      message.workerBaseUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev"
    ).replace(/\/+$/, "");

    fetch(`${workerBase}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then(async (res) => {
        const data = await res.json();
        sendResponse(data);
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || String(err) });
      });
    return true;
  }

  if (message?.type === "MVL_SYNC_PLANE") {
    const workerBase = (
      message.workerBaseUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev"
    ).replace(/\/+$/, "");

    fetch(`${workerBase}/api/plane/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pat: message.pat,
        hostUrl: message.hostUrl,
        workspaceSlug: message.workspaceSlug,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        sendResponse(data);
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || String(err) });
      });
    return true;
  }

  if (message?.type === "MVL_FETCH_MODULES") {
    const workerBase = (
      message.workerBaseUrl || "https://mvl-ui-feedback-mcp.warhorses94.workers.dev"
    ).replace(/\/+$/, "");

    fetch(
      `${workerBase}/api/plane/modules?project_id=${encodeURIComponent(message.projectId || "")}`,
      {
        method: "GET",
        headers: {
          "X-Plane-Pat": message.pat || "",
        },
      }
    )
      .then(async (res) => {
        const data = await res.json();
        sendResponse(data);
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || String(err) });
      });
    return true;
  }
});
