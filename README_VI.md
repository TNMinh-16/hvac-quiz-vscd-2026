# HVAC Quiz – ASHRAE VSCD 2026

Hướng dẫn cài đặt và sử dụng ứng dụng luyện tập trắc nghiệm HVAC.

---

## Yêu cầu môi trường

| Phần mềm | Phiên bản tối thiểu | Tải về |
|---|---|---|
| Node.js | 18.x trở lên | https://nodejs.org/ |
| Python | 3.9 trở lên | https://python.org/ |
| pip | đi kèm Python | — |

> **Hệ điều hành:** Windows 10/11 (khuyến nghị), macOS, Linux

---

## Cài đặt lần đầu

### Bước 1: Cài Node.js dependencies

Mở terminal (Command Prompt hoặc PowerShell) trong thư mục dự án:

```batch
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Bước 2: Cài Python dependencies

```batch
pip install -r scripts/requirements.txt
```

Nếu máy có nhiều Python, dùng `pip3`:

```batch
pip3 install -r scripts/requirements.txt
```

### Bước 3: Nhập dữ liệu từ file Word

Đảm bảo file Word đã có trong thư mục dự án:

```
HVAC_ASHRAE_VSCD_2026_Question_Bank_Full_Bilingual_EN_VI.docx
```

Chạy lệnh import:

```batch
npm run import-docx
```

Kết quả thành công sẽ hiển thị:

```
KẾT QUẢ: THÀNH CÔNG
  Câu hỏi : 304
  Phần    : 31
  Ảnh     : 13
```

Nếu có lỗi, xem chi tiết tại `data/import-report.json`.

---

## Chạy ứng dụng

### Cách 1: Nhấp đúp vào `start.bat` (đơn giản nhất)

File `start.bat` sẽ tự động:
- Kiểm tra dữ liệu, import nếu cần
- Build frontend nếu chưa có
- Khởi động server
- Mở trình duyệt tại http://localhost:3000

### Cách 2: Chạy thủ công (production)

```batch
REM Build frontend (chỉ cần làm 1 lần)
npm run build

REM Chạy server
npm start
```

Mở trình duyệt tại: http://localhost:3000

### Cách 3: Chế độ phát triển (dev mode)

```batch
npm run dev
```

Chế độ này chạy đồng thời:
- Backend tại: http://localhost:3000
- Frontend (Vite hot-reload) tại: http://localhost:5173

---

## Cấu trúc thư mục

```
on_tap/
├── HVAC_ASHRAE_VSCD_2026_Question_Bank_Full_Bilingual_EN_VI.docx
├── start.bat              ← Khởi động nhanh trên Windows
├── package.json           ← Scripts gốc
├── README_VI.md           ← Hướng dẫn tiếng Việt
├── .gitignore
│
├── scripts/
│   ├── import_docx.py     ← Script trích xuất Word → JSON
│   └── requirements.txt   ← Python dependencies
│
├── server/
│   ├── index.js           ← Express server + API
│   ├── dataStore.js       ← Đọc/ghi JSON an toàn
│   ├── scoring.js         ← Tính điểm phía server
│   └── package.json
│
├── client/
│   ├── src/               ← React + TypeScript source
│   ├── dist/              ← Frontend đã build (tạo sau npm run build)
│   └── package.json
│
├── data/
│   ├── questions.json     ← Toàn bộ 304 câu hỏi (tạo sau import-docx)
│   ├── history.json       ← Lịch sử làm bài
│   ├── settings.json      ← Cài đặt người dùng
│   └── import-report.json ← Báo cáo nhập dữ liệu
│
├── public/
│   └── assets/questions/  ← Ảnh trích xuất từ Word
│
└── tests/
    ├── data_validation.test.js
    ├── scoring.test.js
    └── server_api.test.js
```

---

## Vị trí lưu dữ liệu

| File | Mô tả |
|---|---|
| `data/questions.json` | Toàn bộ câu hỏi – chỉ đọc sau khi import |
| `data/history.json` | Lịch sử làm bài – được cập nhật liên tục |
| `data/settings.json` | Cài đặt giao diện |
| `data/import-report.json` | Báo cáo kiểm tra quá trình nhập |
| `public/assets/questions/` | Hình ảnh nhúng trong Word |

---

## Cách sao lưu lịch sử

Sao chép file `data/history.json` ra nơi an toàn:

```batch
copy data\history.json data\history_backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.json
```

Hoặc sao lưu toàn bộ thư mục `data/`:

```batch
xcopy data\ backup_data\ /E /I
```

---

## Cách nhập lại dữ liệu khi file Word thay đổi

1. Đặt file Word mới vào thư mục dự án (giữ nguyên tên)
2. Chạy lại lệnh import:

```batch
npm run import-docx
```

3. Khởi động lại server:

```batch
npm start
```

> **Lưu ý:** Khi nhập lại, `questions.json` sẽ bị ghi đè nhưng `history.json` **không bị ảnh hưởng**.

---

## Cách đổi port

Mặc định server chạy tại cổng 3000. Để đổi cổng, đặt biến môi trường `PORT`:

**Windows (Command Prompt):**

```batch
set PORT=8080
npm start
```

**Windows (PowerShell):**

```powershell
$env:PORT = "8080"
npm start
```

Hoặc tạo file `.env` trong thư mục gốc:

```
PORT=8080
```

---

## Chạy kiểm thử

```batch
npm test
```

Các bài kiểm thử bao gồm:
- Kiểm tra đủ 304 câu hỏi
- Kiểm tra 4 phương án A, B, C, D
- Kiểm tra đáp án đúng hợp lệ
- Kiểm tra ảnh tồn tại
- Kiểm tra tính điểm
- Kiểm tra xáo trộn không trùng câu
- Kiểm tra API endpoints

---

## Xử lý lỗi thường gặp

### Lỗi: "data/questions.json chưa được tạo"

**Nguyên nhân:** Chưa chạy import hoặc import thất bại.

**Giải pháp:**

```batch
python scripts/import_docx.py
```

### Lỗi: "Không tìm thấy file Word"

**Nguyên nhân:** File Word không có trong thư mục dự án.

**Giải pháp:** Đặt file `HVAC_ASHRAE_VSCD_2026_Question_Bank_Full_Bilingual_EN_VI.docx` vào thư mục gốc dự án.

### Lỗi: Port 3000 đã được sử dụng

**Giải pháp:** Đổi port hoặc tắt ứng dụng khác đang dùng cổng 3000.

```batch
set PORT=3001
npm start
```

### Lỗi: "python không được nhận dạng"

**Nguyên nhân:** Python chưa được thêm vào PATH.

**Giải pháp:** 
1. Cài lại Python từ https://python.org/
2. Tích vào ô "Add Python to PATH" khi cài
3. Khởi động lại terminal

### Lỗi: "ModuleNotFoundError: No module named 'docx'"

**Giải pháp:**

```batch
pip install -r scripts/requirements.txt
```

### Lịch sử bị mất sau khi restart

**Kiểm tra:**
- File `data/history.json` có tồn tại không
- Xem log lỗi trong terminal khi server chạy

### Frontend không hiển thị

**Nếu dùng production mode:** Đảm bảo đã build:

```batch
npm run build
npm start
```

**Nếu dùng dev mode:** Kiểm tra cả hai server đang chạy (cổng 3000 và 5173).

---

## Hướng dẫn sử dụng

### Luyện theo phần

1. Nhấn **"📚 Theo phần"** trên thanh điều hướng
2. Chọn cấp Bloom và tiêu chuẩn ASHRAE muốn luyện
3. Nhấn **"Luyện →"** để bắt đầu

### Luyện xáo trộn

1. Nhấn **"🔀 Xáo trộn"** trên thanh điều hướng
2. Chọn bộ lọc (tùy chọn): tiêu chuẩn, cấp Bloom, phần
3. Chọn số lượng câu
4. Nhấn **"🚀 Bắt đầu luyện"**

### Trong khi làm bài

- Nhấn phím **A, B, C, D** để chọn đáp án
- Nhấn **← →** để chuyển câu
- Nhấn **M** để đánh dấu câu
- Nhấn **📋 N câu** để hiện bảng điều hướng
- Nhấn ảnh để phóng to

### Xem kết quả

Sau khi nộp bài, bạn có thể:
- Xem điểm, số đúng/sai
- Nhấn **"Xem đáp án & lời giải"** để đọc giải thích
- Nhấn **"Luyện lại câu sai"** để làm lại các câu đã sai

---

## Thông tin kỹ thuật

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Node.js + Express
- **Dữ liệu:** JSON files (không cần database)
- **Port mặc định:** 3000
- **Không cần kết nối internet** sau khi cài đặt xong
