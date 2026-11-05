/**
 * MVL Page Bridge (`MAIN` world)
 * Extracts React Fiber component names, `_debugSource` (file:line on Dev/Local),
 * and `memoizedProps` keys (works on Production minified builds too!)
 * + Recent XHR/Fetch API calls from `PerformanceResourceTiming`.
 */
(function () {
  if (window.__MVL_PAGE_BRIDGE_INSTALLED__) return;
  window.__MVL_PAGE_BRIDGE_INSTALLED__ = true;

  function getReactFiberFromNode(domNode) {
    if (!domNode) return null;
    const keys = Object.keys(domNode);
    for (const k of keys) {
      if (k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")) {
        return domNode[k];
      }
    }
    return null;
  }

  function extractReactInfo(el) {
    let curr = el;
    let fiber = null;
    while (curr && curr !== document.body && !fiber) {
      fiber = getReactFiberFromNode(curr);
      curr = curr.parentElement;
    }
    if (!fiber) {
      return {
        reactComponent: "",
        reactSource: "",
        reactProps: {},
      };
    }

    const componentNames = [];
    let sourceLocation = "";
    let propsSummary = {};
    let pointer = fiber;
    let depth = 0;

    while (pointer && depth < 20) {
      depth++;
      const type = pointer.type;
      if (type && typeof type !== "string") {
        const name = type.displayName || type.name || pointer.elementType?.name || "";
        if (name && name.length > 1 && !componentNames.includes(name)) {
          componentNames.push(name);
        }
        if (Object.keys(propsSummary).length === 0 && pointer.memoizedProps && typeof pointer.memoizedProps === "object") {
          for (const [pk, pv] of Object.entries(pointer.memoizedProps)) {
            if (pk === "children" || pk.startsWith("_")) continue;
            if (typeof pv === "string" || typeof pv === "number" || typeof pv === "boolean") {
              propsSummary[pk] = String(pv).slice(0, 80);
            } else if (typeof pv === "function") {
              propsSummary[pk] = "[Function]";
            } else if (Array.isArray(pv)) {
              propsSummary[pk] = `Array(${pv.length})`;
            } else if (pv && typeof pv === "object") {
              propsSummary[pk] = "{Object}";
            }
          }
        }
      }
      if (!sourceLocation && pointer._debugSource) {
        const ds = pointer._debugSource;
        if (ds.fileName) {
          sourceLocation = `${ds.fileName}:${ds.lineNumber || 1}:${ds.columnNumber || 1}`;
        }
      }
      pointer = pointer.return;
    }

    return {
      reactComponent: componentNames.slice(0, 4).join(" < ") || "",
      reactSource: sourceLocation,
      reactProps: propsSummary,
    };
  }

  function getRecentApiCalls() {
    try {
      const entries = performance.getEntriesByType("resource") || [];
      const apiEntries = entries
        .filter(
          (e) =>
            (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest") &&
            !e.name.includes("mvl-ui-feedback-mcp") &&
            !e.name.includes("google-analytics")
        )
        .slice(-6)
        .map((e) => {
          try {
            const u = new URL(e.name);
            return `${u.pathname}${u.search}`;
          } catch {
            return e.name;
          }
        });
      return Array.from(new Set(apiEntries));
    } catch {
      return [];
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "MVL_INSPECT_POINT_REQUEST") return;
    const { x, y, requestId } = event.data;
    const el = document.elementFromPoint(x, y) || document.body;
    const reactInfo = extractReactInfo(el);
    const recentApis = getRecentApiCalls();

    window.postMessage(
      {
        type: "MVL_INSPECT_POINT_RESPONSE",
        requestId,
        reactInfo,
        recentApis,
      },
      "*"
    );
  });
})();
