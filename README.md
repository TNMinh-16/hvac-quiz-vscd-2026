# HVAC Quiz – ASHRAE VSCD 2026

Ứng dụng web luyện trắc nghiệm chuyên sâu các tiêu chuẩn HVAC (ASHRAE 52.2, 55, 62.1, 62.1-2022, 90.1 và các cấp độ tư duy Bloom 1–6) dựa trên tài liệu **ASHRAE VSCD 2026**.

## 🎯 Mục tiêu & Đặc điểm Kiến trúc
- **Không yêu cầu đăng ký / đăng nhập (No Auth):** Đây là hệ thống ôn tập thi cử chuyên sâu, mọi thao tác luyện tập lập tức sẵn sàng khi truy cập mà không rào cản tài khoản hay quảng cáo.
- **Lịch sử chung toàn cầu (Global Cloud History):** Khi chạy trên internet, bộ lịch sử làm bài được đồng bộ chung trên nền tảng cloud của **Supabase PostgreSQL**, phục vụ tra cứu và tiếp tục bài thi đang làm dở tại bất cứ trình duyệt nào.
- **Dữ liệu 379 câu hỏi trọn vẹn (Nguyên bản tuyệt đối):** Toàn bộ 379 câu hỏi cùng 18 tệp hình ảnh kỹ thuật gốc được trích xuất từ 2 tài liệu chính thức (`HVAC_ASHRAE_VSCD_2026_Question_Bank_Full_Bilingual_EN_VI.docx` và `Bo_75_cau_trac_nghiem_HVAC_song_ngu_Anh_Viet_ASHRAE_62_1_2022.docx`).
  - **Mã SHA-256 đối chiếu (Word 1):** `f56e685cc94cc7a9cc2ddf48666c177fe40df7c5a386bdfecd1b54fc8374dab0`
  - **Mã SHA-256 đối chiếu (questions.json):** `55625d8f3a4db94889aca579a2ac922f4fcccec18fd099c0a16a813202093f5d`
  - Hình ảnh phục vụ nguyên bản không compress, không crop, chất lượng cao nhất.
- **Bảo mật lời giải tầng Server:** Khi đang thi (`in_progress`), mọi trường đáp án (`correctOptionId`) và lời giải chi tiết (`explanation`) đều bị vô hiệu hóa hoàn toàn trước khi trả về Frontend. Mã lỗi HTTP `403 Forbidden` sẽ lập tức được thực thi nếu vi phạm hay nỗ lực đọc trước đáp án.

---

## 🚀 Hướng Dẫn Vận Hành (2 Chế độ Cắm Nóng)

Hệ thống được lập trình đa tầng với `sessionStore.js` hỗ trợ chuyển đổi siêu mượt giữa 2 environment thông qua biến `DATA_BACKEND`:

### 1. Vận Hành Offline Tại PC Cả Nhân (Chế độ `DATA_BACKEND=json`)
- Mặc định khi làm việc local hoặc dev. Lịch sử bài làm lưu trong `data/history.json`.
- **Khởi động siêu tốc hàng ngày:**
  Nháy đúp (Double-click) vào tệp **`start.bat`** tại thư mục root. Server sẽ khởi động trên cổng 3000 và tự động phát mở tab trình duyệt!
- **Khởi động bằng lệnh Terminal (Thạc sĩ / Kỹ sư Dev):**
  ```bash
  # Cài đặt toàn bộ thư viện cho Workspace (root, client, server)
  npm install

  # Xây dựng bản build tối ưu Frontend (hoặc chạy mode dev)
  npm run build

  # Kích hoạt Node.js server (chạy đồng thời Frontend + API tại localhost:3000)
  node server/index.js
  ```

---

### 2. Triển Khai Cloud Internet (Render Web Service + Supabase PostgreSQL)

#### A. Cấu Hình CSDL Supabase PostgreSQL
1. Truy cập [Supabase Console](https://supabase.com), tạo project PostgreSQL.
2. Mở trình **SQL Editor** và chạy tệp migration bảo mật:
   **`supabase/migrations/001_quiz_sessions.sql`**
   - Migration sẽ tự tạo schema ẩn **`private.quiz_sessions`** cùng hệ thống check constraints chẽ, indexes tốc độ cao cho trạng thái thi và thời gian completed.
   - Bảng được ngắt kết nối với public PostgREST Data API để chống đọc trích trốn truy vết.
3. Vào **Settings -> Database**, copy **Connection String** ở chế độ **Session / Transaction Connection Pooler (Cổng 6543 hoặc 5432)**, định dạng:
   `postgresql://postgres.xxx:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require`

#### B. Đưa Lên Platform Render Web Service
Dự án có sẵn cấu hình tự động cho Render: **`render.yaml`** (Hoạt động tốt cả với gói **Free Tier**).

Cài đặt Environment Variables tại Dashboard Render:
| Biến Môi Trường | Giá trị bắt buộc | Description |
|---|---|---|
| `NODE_ENV` | `production` | Bật chế độ tối ưu cho Express (Helmet, Compression, Rate Limit) |
| `DATA_BACKEND` | `postgres` | Kích hoạt cắm nóng vào Supabase PostgreSQL |
| `DATABASE_URL` | `postgresql://...` | Chuỗi kết nối từ Supabase Connection Pooler |

- **Quá trình Build tự động:**
  Command: `npm install && npm test && npm run build` (Tự kiểm chứng 42 test suite tự động bảo vệ tính chính xác của bộ 379 câu hỏi trước khi đóng gói).
- **Quá trình Start tự động:**
  Command: `node server/index.js` (Bind 0.0.0.0 theo chuẩn yêu cầu cloud).
- **Trạng thái theo dõi sức khỏe:**
  Truy cập endpoint **`/api/health`** để test sống kết nối Database và kiểm tra con số 379 câu hỏi (Trả về 200 OK nếu healthy hoặc 503 nếu lỗi ngắt mạng).

---

## 🛠 Nền Tảng Kỹ Thuật (Tech Stack & Architecture)
- **Frontend Workspaces (`/client`):** React 18, TypeScript, Vite, Vanilla CSS theo chuẩn UI Design Tokens hiện đại (Glassmorphism, Card HSL dark/light tones), Tương thích 100% thiết bị Mobile di động dạng Responsive Vertical Card (Đóng trượt mượt mà cho cảm ứng tay).
- **Backend Workspaces (`/server`):** Node.js 20, Express, Supertest, Helmet, Compression, Express-Rate-Limit, PostgreSQL Client (`pg`).
- **Autosave & Concurrency Protection:** Dữ liệu nộp tự động (Autosave Debounce 1.5s) kèm bảo vệ ngắt trang đột ngột qua **`navigator.sendBeacon / fetch keepalive`**. Kỹ thuật **Atomic JSONB Merge** (`||`) giải quyết hoàn toàn rủi ro ghi đè khi mở song song hai giao diện làm bài.

---
*Dự án HVAC Quiz ASHRAE VSCD 2026 – Ôn tập kiên cố, chứng chỉ vững vàng!*
