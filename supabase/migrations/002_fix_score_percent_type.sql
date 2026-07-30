-- Migration 002: Đổi kiểu score_percent từ INTEGER sang NUMERIC(5,1)
-- Lý do: scoring.js tính điểm dạng float (ví dụ: 66.7, 72.5), INTEGER tự động truncate
-- → Mất độ chính xác khi hiển thị điểm. NUMERIC(5,1) hỗ trợ đến 9999.9.
-- QUAN TRỌNG: Chạy lệnh này trong Supabase SQL Editor nếu table đã tồn tại.

ALTER TABLE private.quiz_sessions
  ALTER COLUMN score_percent TYPE NUMERIC(5,1) USING score_percent::NUMERIC(5,1);
