# ✂️ SnapUI v2.6.0 — Visual Feedback, Multi-Provider Issue Engine & Remote MCP

Giải pháp khoanh vùng giao diện, ghim Marker đánh số tối giản (`1`, `2`, `3`), tự động đính kèm file ảnh vào **Plane, Linear, Jira, GitHub Issues** hoặc đẩy thẳng vào **Cloudflare Remote MCP (`/mcp`)** cho các AI Coding Agents (**Antigravity, Claude Code, Cursor, Windsurf**).

- 🌐 **Product Landing Page & Interactive MCP Guide:** [https://mvl-ui-feedback-mcp.warhorses94.workers.dev/landing](https://mvl-ui-feedback-mcp.warhorses94.workers.dev/landing)
- 🔌 **Remote MCP Endpoint (Streamable HTTP / JSON-RPC):** `https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp`
- 📦 **GitHub Release (`v2.6.0`):** [https://github.com/Hungmaix94/mvl-ui-feedback-extension/releases/tag/v2.6.0](https://github.com/Hungmaix94/mvl-ui-feedback-extension/releases/tag/v2.6.0)
- 🎬 **Video Giới Thiệu Sản Phẩm (Recordly 7 Use Cases — Giọng Thuyết Minh Adam Bựa EN/VI):** [https://pub-dd118e9f58254711a5ec2f75e6bf0530.r2.dev/test-videos/snapui_recordly_voiceover_vi.mp4](https://pub-dd118e9f58254711a5ec2f75e6bf0530.r2.dev/test-videos/snapui_recordly_voiceover_vi.mp4)

---

## 📖 User Guide: Kết Nối Remote MCP Cho Các AI Coding Agents

Sau khi bật **DEV Mode** trên Extension SnapUI và bấm **Create** để bắn ảnh chụp vùng lỗi + tọa độ Marker lên Cloudflare Worker, bạn chỉ cần kết nối AI Agent của mình vào địa chỉ Remote MCP dưới đây để AI tự động đọc ảnh R2 và sửa code.

### 1. Kết nối trong Google Antigravity
Mở file cấu hình `~/.gemini/antigravity/mcp_config.json` (hoặc vào mục **MCP Servers → Edit Config**) và thêm server `mvl-ui-feedback`:

```json
{
  "mcpServers": {
    "mvl-ui-feedback": {
      "serverUrl": "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp"
    }
  }
}
```

### 2. Kết nối trong Claude Code (CLI / IDE)
**Cách 1 — Chạy lệnh CLI 1 chạm trên Terminal:**
```bash
claude mcp add --transport http mvl-ui-feedback https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp
```

**Cách 2 — Thêm vào file `.mcp.json` tại thư mục gốc của repo:**
```json
{
  "mcpServers": {
    "mvl-ui-feedback": {
      "type": "http",
      "url": "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp"
    }
  }
}
```

### 3. Kết nối trong Cursor IDE
Mở `~/.cursor/mcp.json` (hoặc `.cursor/mcp.json` trong thư mục dự án, hoặc vào **Cursor Settings → MCP → Add new global MCP server**):

```json
{
  "mcpServers": {
    "mvl-ui-feedback": {
      "url": "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp"
    }
  }
}
```

### 4. Kết nối trong Windsurf / Cline / Các Agent dùng `stdio`
Nếu Agent chỉ hỗ trợ `stdio`, dùng gói cầu nối `mcp-remote` qua `npx`:

```json
{
  "mcpServers": {
    "mvl-ui-feedback": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp"
      ]
    }
  }
}
```

---

## 🛠️ Danh Sách 4 MCP Tools Cung Cấp Cho AI Agent

Khi kết nối thành công, AI Agent sẽ tự động nhìn thấy và gọi được 4 công cụ sau:

| Tên MCP Tool | Tham số chính | Chức năng |
| :--- | :--- | :--- |
| **`get_latest_dev_feedbacks`** | `limit` (mặc định `5`), `mode` (`dev`/`qa`/`all`), `status` (`pending`/`resolved`/`all`), `page_url_contains` | Lấy danh sách các điểm ghim UI, ảnh chụp vùng chọn R2 (`screenshotUrl`, `annotations`) và ngữ cảnh SRS mới nhất vừa gửi từ Extension. |
| **`get_feedback_by_plane_task`** | `task_identifier` (VD: `"MVLCTV-1075"` hoặc UUID) | Tra cứu toàn bộ ảnh chụp R2, danh sách các Marker (`#1`, `#2`, `#3`) và tài liệu SRS của một mã Task cụ thể. |
| **`list_page_feedbacks`** | `pathname_or_url` (VD: `"/appsale"`), `status` | Liệt kê tất cả các điểm ghim lỗi UI đang mở trên một đường dẫn trang cụ thể. |
| **`resolve_ui_feedback`** | `id_or_task`, `resolution_note` | Đánh dấu feedback hoặc mã Task đã được AI sửa xong (`status = 'resolved'`) kèm ghi chú commit/PR. |

---

## 💬 Câu Lệnh Prompt Mẫu Khi Chat Với AI Agent

Bạn chỉ cần gõ một trong các câu lệnh ngắn gọn sau vào khung chat của **Antigravity / Claude Code / Cursor**:

- **Khi đang code ở chế độ `DEV Mode`:**
  > *"Lấy feedback UI mới nhất từ MCP `mvl-ui-feedback`, xem ảnh chụp các Marker và sửa code giao diện giúp tôi, xong gọi `resolve_ui_feedback`."*
- **Khi muốn sửa một Task do QA vừa tạo trên Plane:**
  > *"Dùng MCP `mvl-ui-feedback` đọc ảnh chụp và các Marker của task `MVLCTV-1075` rồi sửa lỗi giao diện tương ứng."*
- **Khi muốn rà soát toàn bộ lỗi UI trên một trang:**
  > *"Liệt kê tất cả các điểm ghim UI đang pending trên trang `/appsale` qua MCP `mvl-ui-feedback` và xử lý lần lượt."*

---

## 🚀 Hướng dẫn Cài đặt Chrome Extension (30 giây)

1. Mở trình duyệt Chrome / Edge / Brave, truy cập: `chrome://extensions/`
2. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
3. Bấm nút **Load unpacked (Tải tiện ích đã giải nén)** và chọn thư mục:
   `/Users/phamhung/D/Work/MVL/slackbot/ui-feedback-workflow/chrome-extension` (hoặc `/Applications/SnapUI-Extension`).
4. Danh sách **Working Pages** đã được cấu hình sẵn cho Team: `maivietland.vn`, `glinteco.com`, `up.railway.app`, `localhost`, `127.0.0.1`.
