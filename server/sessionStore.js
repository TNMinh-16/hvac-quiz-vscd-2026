/**
 * sessionStore.js – Storage Adapter cho Lịch Sử Làm Bài
 * Hỗ trợ 2 chế độ (giảm thiểu Xung đột & Idempotent):
 * - json: Lưu local ổ đĩa qua dataStore (Mặc định cho môi trường dev / test)
 * - postgres: Lưu trên Supabase PostgreSQL Cloud qua Connection Pooler
 */
const { Pool } = require("pg");
const dataStore = require("./dataStore");

let pool = null;

function getBackendMode() {
  const mode = (process.env.DATA_BACKEND || "json").toLowerCase();
  if (process.env.NODE_ENV === "production" && mode === "postgres" && !process.env.DATABASE_URL) {
    throw new Error("LỖI NGHIÊM TRỌNG (Production): Chế độ postgres được kích hoạt nhưng thiếu chuỗi kết nối DATABASE_URL!");
  }
  return mode === "postgres" ? "postgres" : "json";
}

function initPool() {
  if (getBackendMode() === "postgres" && !pool) {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Missing DATABASE_URL in production environment");
      }
      return null;
    }
    pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on("error", (err) => {
      console.error("[Postgres Pool Error]:", err.message);
    });
  }
  return pool;
}

async function checkHealth() {
  const mode = getBackendMode();
  if (mode === "postgres") {
    try {
      const dbPool = initPool();
      if (!dbPool) return { status: "error", backend: "postgres", message: "DATABASE_URL not configured" };
      const client = await dbPool.connect();
      await client.query("SELECT 1 as val");
      client.release();
      return { status: "ok", backend: "postgres" };
    } catch (e) {
      return { status: "error", backend: "postgres", message: e.message };
    }
  } else {
    try {
      const history = dataStore.getHistory();
      return { status: "ok", backend: "json", sessionsCount: history.sessions.length };
    } catch (e) {
      return { status: "error", backend: "json", message: e.message };
    }
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Helper: Chuyển đổi hàng từ PostgreSQL sang JS object (camelCase)
function rowToSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : new Date().toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    sectionIds: typeof row.section_ids === "string" ? JSON.parse(row.section_ids) : (row.section_ids || []),
    filters: typeof row.filters === "string" ? JSON.parse(row.filters) : (row.filters || {}),
    questionOrder: typeof row.question_order === "string" ? JSON.parse(row.question_order) : (row.question_order || []),
    answers: typeof row.answers === "string" ? JSON.parse(row.answers) : (row.answers || {}),
    markedQuestionIds: typeof row.marked_question_ids === "string" ? JSON.parse(row.marked_question_ids) : (row.marked_question_ids || []),
    correctCount: Number(row.correct_count || 0),
    wrongCount: Number(row.wrong_count || 0),
    unansweredCount: Number(row.unanswered_count || 0),
    scorePercent: Number(row.score_percent || 0),
    durationSeconds: Number(row.duration_seconds || 0),
    revision: Number(row.revision || 1),
  };
}

async function createSession(session) {
  const mode = getBackendMode();
  if (mode === "postgres") {
    const dbPool = initPool();
    const query = `
      INSERT INTO private.quiz_sessions (
        id, status, mode, started_at, completed_at,
        section_ids, filters, question_order, answers, marked_question_ids,
        correct_count, wrong_count, unanswered_count, score_percent, duration_seconds, revision
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb,
        $11, $12, $13, $14, $15, 1
      ) RETURNING *;
    `;
    const values = [
      session.id,
      session.status || "in_progress",
      session.mode || "sequential",
      session.startedAt || new Date().toISOString(),
      session.completedAt || null,
      JSON.stringify(session.sectionIds || []),
      JSON.stringify(session.filters || {}),
      JSON.stringify(session.questionOrder || []),
      JSON.stringify(session.answers || {}),
      JSON.stringify(session.markedQuestionIds || []),
      session.correctCount || 0,
      session.wrongCount || 0,
      session.unansweredCount !== undefined ? session.unansweredCount : (session.questionOrder || []).length,
      session.scorePercent || 0,
      session.durationSeconds || 0,
    ];
    const res = await dbPool.query(query, values);
    return rowToSession(res.rows[0]);
  } else {
    const history = dataStore.getHistory();
    history.sessions.push(session);
    // Giới hạn lưu tối đa 200 session gần nhất để tránh history.json phình to
    // (mỗi session 3000 câu chiếm ~50KB dữ liệu questionOrder)
    if (history.sessions.length > 200) {
      history.sessions = history.sessions.slice(-200);
    }
    dataStore.saveHistory(history);
    return session;
  }
}

async function getSessionById(id) {
  const mode = getBackendMode();
  if (mode === "postgres") {
    const dbPool = initPool();
    const res = await dbPool.query("SELECT * FROM private.quiz_sessions WHERE id = $1", [id]);
    return rowToSession(res.rows[0]);
  } else {
    const history = dataStore.getHistory();
    const s = history.sessions.find(item => item.id === id);
    return s || null;
  }
}

async function getInProgressSessions() {
  const mode = getBackendMode();
  if (mode === "postgres") {
    const dbPool = initPool();
    const res = await dbPool.query(
      "SELECT * FROM private.quiz_sessions WHERE status = 'in_progress' ORDER BY started_at DESC"
    );
    return res.rows.map(rowToSession);
  } else {
    const history = dataStore.getHistory();
    const list = history.sessions
      .filter(s => s.status === "in_progress")
      .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
    return list;
  }
}

async function getRecentCompletedSessions(limit = 5) {
  const mode = getBackendMode();
  if (mode === "postgres") {
    const dbPool = initPool();
    const res = await dbPool.query(
      "SELECT * FROM private.quiz_sessions WHERE status = 'completed' ORDER BY COALESCE(completed_at, started_at) DESC LIMIT $1",
      [limit]
    );
    return res.rows.map(rowToSession);
  } else {
    const history = dataStore.getHistory();
    const list = history.sessions
      .filter(s => s.status === "completed")
      .sort((a, b) => {
        const timeB = new Date(b.completedAt || b.startedAt || 0).getTime();
        const timeA = new Date(a.completedAt || a.startedAt || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, limit);
    return list;
  }
}

async function getAllSessions(page = 1, limit = 500) {
  const mode = getBackendMode();
  const offset = Math.max(0, (page - 1) * limit);
  if (mode === "postgres") {
    const dbPool = initPool();
    const res = await dbPool.query(
      "SELECT * FROM private.quiz_sessions ORDER BY COALESCE(completed_at, started_at) DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    return res.rows.map(rowToSession);
  } else {
    const history = dataStore.getHistory();
    const list = [...history.sessions].sort((a, b) => {
      const timeB = new Date(b.completedAt || b.startedAt || 0).getTime();
      const timeA = new Date(a.completedAt || a.startedAt || 0).getTime();
      return timeB - timeA;
    });
    return list.slice(offset, offset + limit);
  }
}

async function saveAnswers(id, incomingAnswers, durationSeconds) {
  const mode = getBackendMode();
  if (mode === "postgres") {
    const dbPool = initPool();
    // Chống xung đột: Dùng operator || của jsonb để gộp atomic đáp án, bảo vệ các câu trả lời đồng thời
    const query = `
      UPDATE private.quiz_sessions
      SET 
        answers = COALESCE(answers, '{}'::jsonb) || $2::jsonb,
        duration_seconds = GREATEST(duration_seconds, $3),
        revision = COALESCE(revision, 1) + 1
      WHERE id = $1 AND status = 'in_progress'
      RETURNING *;
    `;
    const res = await dbPool.query(query, [id, JSON.stringify(incomingAnswers || {}), durationSeconds || 0]);
    if (res.rows.length === 0) {
      // Có thể session không tồn tại hoặc đã completed (không thể thay đổi đáp án sau khi hoàn thành)
      return { ok: false, error: "Session không tồn tại hoặc đã được nộp trước đó" };
    }
    return { ok: true, session: rowToSession(res.rows[0]) };
  } else {
    const history = dataStore.getHistory();
    const idx = history.sessions.findIndex(s => s.id === id);
    if (idx === -1) return { ok: false, error: "Session không tồn tại" };
    const session = history.sessions[idx];
    if (session.status === "completed") {
      return { ok: false, error: "Bài làm đã hoàn thành, không thể sửa đáp án" };
    }
    const allowed = new Set(session.questionOrder);
    if (!session.answers) session.answers = {};
    for (const [qid, ans] of Object.entries(incomingAnswers || {})) {
      if (allowed.has(qid) && ["A", "B", "C", "D"].includes(ans)) {
        session.answers[qid] = ans;
      }
    }
    if (typeof durationSeconds === "number" && !isNaN(durationSeconds)) {
      session.durationSeconds = Math.max(session.durationSeconds || 0, durationSeconds);
    }
    session.revision = (session.revision || 1) + 1;
    history.sessions[idx] = session;
    dataStore.saveHistory(history);
    return { ok: true, session };
  }
}

async function saveMarks(id, markedQuestionIds) {
  const mode = getBackendMode();
  if (mode === "postgres") {
    const dbPool = initPool();
    const query = `
      UPDATE private.quiz_sessions
      SET marked_question_ids = $2::jsonb, revision = COALESCE(revision, 1) + 1
      WHERE id = $1 AND status = 'in_progress'
      RETURNING *;
    `;
    const res = await dbPool.query(query, [id, JSON.stringify(markedQuestionIds || [])]);
    if (res.rows.length === 0) {
      return { ok: false, error: "Session không tồn tại hoặc đã hoàn thành" };
    }
    return { ok: true, session: rowToSession(res.rows[0]) };
  } else {
    const history = dataStore.getHistory();
    const idx = history.sessions.findIndex(s => s.id === id);
    if (idx === -1) return { ok: false, error: "Session không tồn tại" };
    const session = history.sessions[idx];
    if (session.status === "completed") {
      return { ok: false, error: "Bài làm đã hoàn thành, không thể sửa mark" };
    }
    const allowed = new Set(session.questionOrder);
    session.markedQuestionIds = (markedQuestionIds || []).filter(qid => allowed.has(qid));
    session.revision = (session.revision || 1) + 1;
    history.sessions[idx] = session;
    dataStore.saveHistory(history);
    return { ok: true, session };
  }
}

// Nộp bài Idempotent: Nếu bài đã completed, không tính lại hay lỗi mà trả trực tiếp session
async function submitSession(id, calculatedResult) {
  const mode = getBackendMode();
  if (mode === "postgres") {
    const dbPool = initPool();
    // Trước tiên tra soát idempotent
    const checkRes = await dbPool.query("SELECT * FROM private.quiz_sessions WHERE id = $1", [id]);
    if (checkRes.rows.length === 0) return { ok: false, error: "Session không tồn tại", code: 404 };
    const existing = rowToSession(checkRes.rows[0]);
    if (existing.status === "completed") {
      return { ok: true, session: existing, idempotent: true };
    }
    const now = new Date().toISOString();
    const updateQuery = `
      UPDATE private.quiz_sessions
      SET 
        status = 'completed',
        completed_at = $2,
        correct_count = $3,
        wrong_count = $4,
        unanswered_count = $5,
        score_percent = $6,
        duration_seconds = GREATEST(duration_seconds, $7),
        revision = COALESCE(revision, 1) + 1
      WHERE id = $1 AND status = 'in_progress'
      RETURNING *;
    `;
    const values = [
      id,
      now,
      calculatedResult.correctCount || 0,
      calculatedResult.wrongCount || 0,
      calculatedResult.unansweredCount || 0,
      calculatedResult.scorePercent || 0,
      calculatedResult.durationSeconds || existing.durationSeconds || 0,
    ];
    const res = await dbPool.query(updateQuery, values);
    if (res.rows.length === 0) {
      // Trường hợp race condition, đã có request khác submit
      const reCheck = await dbPool.query("SELECT * FROM private.quiz_sessions WHERE id = $1", [id]);
      return { ok: true, session: rowToSession(reCheck.rows[0]), idempotent: true };
    }
    return { ok: true, session: rowToSession(res.rows[0]) };
  } else {
    const history = dataStore.getHistory();
    const idx = history.sessions.findIndex(s => s.id === id);
    if (idx === -1) return { ok: false, error: "Session không tồn tại", code: 404 };
    const session = history.sessions[idx];
    if (session.status === "completed") {
      return { ok: true, session, idempotent: true };
    }
    session.status = "completed";
    session.completedAt = new Date().toISOString();
    if (typeof calculatedResult.durationSeconds === "number" && !isNaN(calculatedResult.durationSeconds)) {
      session.durationSeconds = Math.max(session.durationSeconds || 0, calculatedResult.durationSeconds);
    }
    session.correctCount = calculatedResult.correctCount || 0;
    session.wrongCount = calculatedResult.wrongCount || 0;
    session.unansweredCount = calculatedResult.unansweredCount || 0;
    session.scorePercent = calculatedResult.scorePercent || 0;
    session.revision = (session.revision || 1) + 1;
    history.sessions[idx] = session;
    dataStore.saveHistory(history);
    return { ok: true, session };
  }
}

module.exports = {
  getBackendMode,
  initPool,
  checkHealth,
  closePool,
  createSession,
  getSessionById,
  getInProgressSessions,
  getRecentCompletedSessions,
  getAllSessions,
  saveAnswers,
  saveMarks,
  submitSession,
};
