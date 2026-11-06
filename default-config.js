/**
 * Default Configuration for MVL UI Feedback Extension
 * - Pre-configured with the previously connected Plane account PAT (Pham Hung - hung.phamduc@glinteco.com)
 * - Pre-configured with Cloudflare Remote MCP Worker URL (Free Tier)
 * - Pre-configured with Production, Dev Online (Railway/Glinteco), and Localhost Auto-Detect Rules
 */

const MVL_DEFAULT_CONFIG = {
  mode: "qa", // "dev" (bắn vào MCP) | "qa" (tạo task lên Provider + lưu MCP)
  taskProvider: "plane", // "plane" | "linear" | "jira" | "github"
  captureType: "crop", // "crop" (mặc định chụp ảnh crop) | "video" (quay clip)
  showFloatingButton: true,
  floatingFilterMode: "whitelist", // "whitelist" (chỉ hiện trên các page làm việc của team) | "all" (mọi trang)
  floatingAllowedPatterns: [
    "maivietland.vn",
    "glinteco.com",
    "up.railway.app",
    "localhost",
    "127.0.0.1",
  ],
  workerBaseUrl: "https://mvl-ui-feedback-mcp.warhorses94.workers.dev",
  mcpEndpointUrl: "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp",

  // Cấu hình đa Provider quản lý Task (Linear, Jira, GitHub Issues)
  providers: {
    linear: {
      apiKey: "",
      teamKey: "MVL",
    },
    jira: {
      hostUrl: "https://glinteco.atlassian.net",
      email: "hung.phamduc@glinteco.com",
      apiToken: "",
      projectKey: "MVL",
      issueType: "Bug",
    },
    github: {
      token: "",
      repo: "Hungmaix94/mvl-ui-feedback-extension",
      labels: "bug",
    },
  },

  // Mặc định lấy PAT của account Plane đã gắn trước đó trên Worker (Pham Hung - hung.phamduc@glinteco.com)
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
  defaultModuleId: "be359244-fdc3-46d5-8151-46ffa6506bff",
  defaultModuleName: "App Sale",
  defaultPriority: "medium",

  // Danh sách các Project được bật trong dropdown (cho phép cấu hình ẩn/hiện trong Popup)
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

  projects: [
    { id: "e92f7ba8-0db9-487f-a21c-13712d226eb8", identifier: "MVLCTV", name: "MaiVietLand Phase 3" },
    { id: "ef79ee12-dbe4-415a-bc9f-6cf91ba944f2", identifier: "MVL", name: "MaiVietLand Phase 1 2" },
    { id: "51d54abd-bb88-41de-b7f9-c9b335c34dda", identifier: "MVLGO", name: "MVL-GoLive" },
    { id: "87148fce-00c3-42c4-9369-a7af6cb9cc50", identifier: "MAIVIETLAN", name: "MaiVietLand Support" },
    { id: "d696de1d-c7a2-4de3-9116-69b6165d3f1d", identifier: "CRM", name: "CRM" },
    { id: "16f47d68-0e36-4396-99eb-6683cef1815e", identifier: "FETEAMS", name: "FE teams" },
    { id: "3d7e5ccd-6e4d-4c0a-a958-b959d55ce956", identifier: "MVL4", name: "MaiVietLand Phase 4" },
    { id: "3ba1f420-e341-4303-9c54-a0d241502c41", identifier: "DEVOPS", name: "Devops" },
    { id: "cf0566c2-1155-474c-9fd5-bf9f50eef3da", identifier: "DSTAX", name: "DsTax" },
    { id: "08e46aee-8c24-4bb3-9b91-d85f5ed362df", identifier: "GLINTECOWEBS", name: "Glinteco Website" },
  ],

  modulesByProject: {
    "e92f7ba8-0db9-487f-a21c-13712d226eb8": [
      { id: "be359244-fdc3-46d5-8151-46ffa6506bff", name: "App Sale" },
      { id: "4bc93124-68cf-47ed-99c7-08129d31148c", name: "CRM" },
      { id: "bec0f2bc-7fb4-4992-86fd-3eb7072f8e97", name: "Trợ lý AI" },
      { id: "d87a9da8-738c-414f-ab93-0d93a2173925", name: "Design Revamp" },
      { id: "3a04e90c-a3b4-454f-9a66-9b3dfc5df66e", name: "Test phase 3.1" },
      { id: "8edd6e38-5ede-4ff4-9a10-60f24e7d8c8c", name: "Help center" },
    ],
    "ef79ee12-dbe4-415a-bc9f-6cf91ba944f2": [
      { id: "56f2903d-fc66-4792-9a02-a9f183d76b92", name: "20. Quản lý thanh toán hoa hồng+thưởng" },
      { id: "8a17b07b-ae0e-4ae6-8bf2-ff9b9e8e0ff6", name: "19. Quản lý booking" },
      { id: "dffccbac-c659-4d67-b312-e54bd43c74c0", name: "18. Quản lý đặt cọc và hợp đồng" },
      { id: "4136c031-6754-4af6-b828-a3fd45f7bdf9", name: "17. Quản lý dự án" },
      { id: "99cc3c56-9e02-4597-9f56-74ee90d84227", name: "24. Sàn liên kết F2" },
      { id: "3ec9f729-b01c-46f2-a388-8ba51df8fde6", name: "25. CRM" },
      { id: "2815b59f-085d-464a-96d7-7297cdb3fef1", name: "26. Dashboard quản lý" },
      { id: "7b807dfe-8eba-4255-b5f0-98da8e861f37", name: "21. Dashboard Kế toán" },
      { id: "0423e35f-0274-4c44-838c-67be8d426920", name: "10. Tính Lương" },
      { id: "486af6d6-5257-474f-9eef-f60b3774e464", name: "8. Quản lý phiếu đánh giá KPI" },
      { id: "72892887-8fdc-4360-83e5-04be282e66f1", name: "6. Quản lý chấm công" },
      { id: "8636303b-b5d9-43b8-889f-2375a5b1f5e8", name: "5. Quản lý Nhân sự" },
      { id: "aa66ee42-593a-4c60-ba77-37a0ba53152d", name: "3. Quản lý phân quyền" },
    ],
    "87148fce-00c3-42c4-9369-a7af6cb9cc50": [
      { id: "49ba618c-a883-4a74-8fd3-4a8df1d44bb5", name: "Support" },
      { id: "203ce2ef-e75c-42a0-b888-2fc0c98a7cb5", name: "Discovery" },
      { id: "3ba26a78-ed52-4c79-b3cc-46776ed3fe32", name: "HelpCenter" },
    ],
    "d696de1d-c7a2-4de3-9116-69b6165d3f1d": [
      { id: "155792a4-9fa3-42af-ba84-6c2d7a811fa4", name: "Leads" },
      { id: "b4bdc0ac-867f-4118-a3a9-4d61474f9fa6", name: "Deals" },
      { id: "d6479d9c-b215-4211-bf07-43549ca29788", name: "Contacts" },
      { id: "946b6330-7066-49d3-a640-2fd00e141704", name: "Accounts" },
    ],
  },

  // Bảng luật Auto-Detect Environment (PROD / DEV-ONL / LOCAL) + Project + Module theo URL
  autoDetectRules: [
    { pattern: "maivietland.vn/appsale", env: "PROD", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "portal.maivietland.vn", env: "PROD", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "erp.maivietland.vn/accounting/commission", env: "PROD", projectCode: "MVL", moduleName: "20. Quản lý thanh toán hoa hồng+thưởng" },
    { pattern: "erp.maivietland.vn/booking", env: "PROD", projectCode: "MVL", moduleName: "19. Quản lý booking" },
    { pattern: "erp.maivietland.vn/deposit", env: "PROD", projectCode: "MVL", moduleName: "18. Quản lý đặt cọc và hợp đồng" },
    { pattern: "erp.maivietland.vn/projects", env: "PROD", projectCode: "MVL", moduleName: "17. Quản lý dự án" },
    { pattern: "erp.maivietland.vn/crm", env: "PROD", projectCode: "MVL", moduleName: "25. CRM" },
    { pattern: "erp.maivietland.vn", env: "PROD", projectCode: "MVL", moduleName: "26. Dashboard quản lý" },
    { pattern: "maivietland.vn", env: "PROD", projectCode: "MVLCTV", moduleName: "App Sale" },

    { pattern: "host-app-production.up.railway.app/appsale", env: "DEV-ONL", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "host-app-production.up.railway.app/cms", env: "DEV-ONL", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "host-app-production.up.railway.app/crm", env: "DEV-ONL", projectCode: "MVLCTV", moduleName: "CRM" },
    { pattern: "host-app-production.up.railway.app", env: "DEV-ONL", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "appsale-production.up.railway.app", env: "DEV-ONL", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "cmsadmin-production-7b06.up.railway.app", env: "DEV-ONL", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "crm-production-0da1.up.railway.app", env: "DEV-ONL", projectCode: "CRM", moduleName: "Leads" },
    { pattern: "erp-web-production-bb1f.up.railway.app/accounting/commission", env: "DEV-ONL", projectCode: "MVL", moduleName: "20. Quản lý thanh toán hoa hồng+thưởng" },
    { pattern: "erp-web-production-bb1f.up.railway.app", env: "DEV-ONL", projectCode: "MVL", moduleName: "26. Dashboard quản lý" },
    { pattern: "mvl.glinteco.com", env: "DEV-ONL", projectCode: "MVL", moduleName: "26. Dashboard quản lý" },
    { pattern: "staging.mvl.glinteco.com", env: "DEV-ONL", projectCode: "MVL", moduleName: "26. Dashboard quản lý" },

    { pattern: "localhost:3006/appsale", env: "LOCAL", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "localhost:3006/crm", env: "LOCAL", projectCode: "MVLCTV", moduleName: "CRM" },
    { pattern: "localhost:3006", env: "LOCAL", projectCode: "MVLCTV", moduleName: "App Sale" },
    { pattern: "localhost:3000/accounting/commission", env: "LOCAL", projectCode: "MVL", moduleName: "20. Quản lý thanh toán hoa hồng+thưởng" },
    { pattern: "localhost:3000", env: "LOCAL", projectCode: "MVL", moduleName: "26. Dashboard quản lý" },
    { pattern: "localhost:5173", env: "LOCAL", projectCode: "FETEAMS", moduleName: "" },
  ],
};

function detectContextFromUrl(urlStr, config) {
  const cfg = config || MVL_DEFAULT_CONFIG;
  const raw = String(urlStr || "").toLowerCase();
  let env = "DEV-ONL";
  if (raw.includes("localhost") || raw.includes("127.0.0.1")) {
    env = "LOCAL";
  } else if (
    raw.includes("maivietland.vn") ||
    (!raw.includes("railway.app") &&
      !raw.includes("staging") &&
      !raw.includes("dev.") &&
      !raw.includes("glinteco.com"))
  ) {
    env = "PROD";
  }

  let matchedRule = null;
  for (const rule of cfg.autoDetectRules || []) {
    if (rule.pattern && raw.includes(String(rule.pattern).toLowerCase())) {
      matchedRule = rule;
      break;
    }
  }

  // Fallback heuristics by pathname keywords
  let projectCode = matchedRule?.projectCode || cfg.defaultProjectCode || "MVLCTV";
  let moduleName = matchedRule?.moduleName || "";
  if (matchedRule?.env) {
    env = matchedRule.env;
  }

  if (!matchedRule) {
    if (raw.includes("/appsale") || raw.includes("/cms")) {
      projectCode = "MVLCTV";
      moduleName = "App Sale";
    } else if (raw.includes("/crm")) {
      projectCode = "MVLCTV";
      moduleName = "CRM";
    } else if (raw.includes("/commission") || raw.includes("/accounting")) {
      projectCode = "MVL";
      moduleName = "20. Quản lý thanh toán hoa hồng+thưởng";
    } else if (raw.includes("/booking")) {
      projectCode = "MVL";
      moduleName = "19. Quản lý booking";
    } else if (raw.includes("/deposit") || raw.includes("/contract")) {
      projectCode = "MVL";
      moduleName = "18. Quản lý đặt cọc và hợp đồng";
    }
  }

  const projects = cfg.projects || MVL_DEFAULT_CONFIG.projects;
  const projectObj =
    projects.find((p) => p.identifier === projectCode) ||
    projects.find((p) => p.id === cfg.defaultProjectId) ||
    projects[0];

  const modules =
    (cfg.modulesByProject && cfg.modulesByProject[projectObj?.id]) ||
    MVL_DEFAULT_CONFIG.modulesByProject[projectObj?.id] ||
    [];

  const moduleObj =
    modules.find((m) => m.name.toLowerCase() === String(moduleName).toLowerCase()) ||
    modules.find((m) => m.name.toLowerCase().includes(String(moduleName).toLowerCase()) && moduleName) ||
    modules[0] ||
    null;

  return {
    env,
    projectId: projectObj ? projectObj.id : cfg.defaultProjectId,
    projectCode: projectObj ? projectObj.identifier : projectCode,
    projectName: projectObj ? projectObj.name : projectCode,
    moduleId: moduleObj ? moduleObj.id : "",
    moduleName: moduleObj ? moduleObj.name : "",
    matchedRulePattern: matchedRule ? matchedRule.pattern : null,
  };
}

function isFloatingAllowedOnUrl(urlStr, config) {
  const cfg = config || MVL_DEFAULT_CONFIG;
  if (cfg.showFloatingButton === false) return false;
  if (cfg.floatingFilterMode === "all") return true;
  const raw = String(urlStr || "").toLowerCase();
  if (!raw) return false;
  const patterns = Array.isArray(cfg.floatingAllowedPatterns)
    ? cfg.floatingAllowedPatterns
    : MVL_DEFAULT_CONFIG.floatingAllowedPatterns || [];
  if (!patterns.length) return true;
  return patterns.some((pat) => {
    const clean = String(pat || "").trim().toLowerCase();
    return clean && raw.includes(clean);
  });
}

if (typeof window !== "undefined") {
  window.MVL_DEFAULT_CONFIG = MVL_DEFAULT_CONFIG;
  window.detectMvlContextFromUrl = detectContextFromUrl;
  window.isMvlFloatingAllowedOnUrl = isFloatingAllowedOnUrl;
}
