-- Migration 001: Tạo bảng quiz_sessions trong schema private
-- Không công khai qua PostgREST (Data API), chỉ cho phép backend Node/Express kết nối trực tiếp qua Connection Pooler.
-- Không chứa thông tin tài khoản (không có user_id, email, password, role, admin).

CREATE SCHEMA IF NOT EXISTS private;

-- Thu hồi quyền truy cập API mặc định (anon, authenticated) trên schema private
REVOKE ALL ON SCHEMA private FROM anon, authenticated, public;

CREATE TABLE IF NOT EXISTS private.quiz_sessions (
    id UUID PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')),
    mode TEXT NOT NULL CHECK (mode IN ('sequential', 'shuffled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    section_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    question_order JSONB NOT NULL DEFAULT '[]'::jsonb,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    marked_question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    wrong_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
    unanswered_count INTEGER NOT NULL DEFAULT 0 CHECK (unanswered_count >= 0),
    score_percent NUMERIC(5,1) NOT NULL DEFAULT 0 CHECK (score_percent >= 0 AND score_percent <= 100),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chỉ số (Indexes) để truy vấn hiệu suất cao cho lịch sử & các bài đang làm dở
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON private.quiz_sessions (status);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_started_at ON private.quiz_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_completed_at ON private.quiz_sessions (completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_updated_at ON private.quiz_sessions (updated_at DESC);

-- Thu hồi quyền trên bảng đối với anon và authenticated
REVOKE ALL ON TABLE private.quiz_sessions FROM anon, authenticated, public;

-- Cấp quyền cho role service_role / postgres (user mặc định của backend DATABASE_URL)
GRANT ALL ON SCHEMA private TO postgres, service_role;
GRANT ALL ON TABLE private.quiz_sessions TO postgres, service_role;

-- Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION private.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_quiz_sessions_updated_at ON private.quiz_sessions;
CREATE TRIGGER trg_quiz_sessions_updated_at
    BEFORE UPDATE ON private.quiz_sessions
    FOR EACH ROW
    EXECUTE FUNCTION private.update_updated_at_column();
