# ✂️ MVL UI Feedback Chrome Extension — Crop to Plane & Cloudflare Remote MCP

Tiện ích Chrome (Manifest V3) giúp **Team QA** và **Team FE** phản hồi trực tiếp trên giao diện Web (kiểu **Antigravity Artifact Inline Commenting**), hoạt động xuyên suốt trên cả **Production**, **Dev Online (`*.up.railway.app`)** và **Localhost (`localhost:3006`)**.

---

## 🌟 Tính năng Chính

1. **Mặc định Kéo chuột Chụp ảnh Crop + Lấy Link hiện tại + Comment:**
   - Kéo chuột khoanh vùng lỗi trên màn hình (chụp nét 100% qua `chrome.tabs.captureVisibleTab`) hoặc chuyển sang quay **Video ngắn**.
   - Tự động đính kèm **Link URL hiện tại** (`window.location.href`) và **Multi-Anchor Fingerprint** (`React Component`, `File:Line`, `React Fiber Props`, `DOM Selector`, `Computed CSS`, `Visible Text Anchors`, `Recent API Calls`) để AI Agent tìm ra chính xác file code ngay cả trên bản build Production đã minify.
2. **Chuyển đổi 2 Chế độ (`👨‍💻 DEV Mode` vs `🕵️‍♀️ QA Mode`) ngay trên Popup & Inline Card:**
   - **`👨‍💻 DEV Mode (Bắn vào MCP)`:** Đẩy ảnh Crop lên Cloudflare R2 và lưu tọa độ kỹ thuật vào **Cloudflare Remote MCP Server** (`https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp`) — không tạo task làm rác Plane.
   - **`🕵️‍♀️ QA Mode (Tạo Task Plane)`:** Tự động tạo Task lên **Plane (`https://pm.glinteco.com`)** bằng PAT của tài khoản đang gắn (mặc định kết nối sẵn tài khoản đã gắn trước đó, hoặc cho phép từng QA nhập PAT riêng), gắn đúng **Project + Module**, ảnh Crop R2 và lưu ngữ cảnh vào MCP theo mã Task vừa tạo.
3. **Auto-detect Môi trường (`[PROD]` / `[DEV-ONL]` / `[LOCAL]`) + Project / Module & Cho phép chọn lại:**
   - Tự động nhận diện Môi trường, Project và Module dựa trên URL hiện tại.
   - Cho phép bấm dropdown **chọn lại Project hoặc Module** ngay trên khung Comment trước khi ấn Gửi.
   - Hỗ trợ đồng bộ danh sách Project/Module từ Plane và cấu hình ẩn/hiện List Project trong Popup.

---

## 🚀 Hướng dẫn Cài đặt (Load Unpacked — 20 giây)

```bash
git clone https://github.com/Hungmaix94/mvl-ui-feedback-extension.git
```

1. Mở trình duyệt Chrome / Edge / Brave, truy cập: `chrome://extensions/`
2. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
3. Bấm **Load unpacked (Tải tiện ích đã giải nén)** và chọn thư mục vừa clone (`mvl-ui-feedback-extension` hoặc `chrome-extension`).
4. Mở trang web cần test/review, bấm nút **`✂️ UI Feedback`** ở góc dưới bên phải (hoặc tổ hợp phím `Alt + Shift + C`).

---

## 🔌 Kết nối Cloudflare Remote MCP Server vào Antigravity / Claude Code / Cursor

Thêm đoạn cấu hình sau vào `mcp.json`:

```json
{
  "mcpServers": {
    "mvl-ui-feedback-mcp": {
      "serverUrl": "https://mvl-ui-feedback-mcp.warhorses94.workers.dev/mcp"
    }
  }
}
```

### Các MCP Tools cung cấp sẵn:
- `get_latest_dev_feedbacks`: Lấy danh sách các điểm UI mà Dev vừa khoanh vùng Crop & Comment.
- `get_feedback_by_plane_task`: Lấy ảnh Crop R2 + tọa độ DOM/React Fiber theo mã Task Plane (VD: `MVLCTV-1089`).
- `list_page_feedbacks`: Lấy toàn bộ các điểm feedback đang pending trên cùng một màn hình để AI sửa gộp 1 lần.
- `resolve_ui_feedback`: Đánh dấu đã sửa xong trên Cloudflare D1.
