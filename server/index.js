/**
 * index.js – Express server cho HVAC Quiz ASHRAE VSCD 2026
 *
 * PORT: Cấu hình qua biến môi trường PORT (mặc định 3000)
 * Tất cả API tại /api/...
 * Static files tại /assets/... (từ public/assets/)
 */

const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");
const { v4: uuidv4 } = require("uuid");

const dataStore = require("./dataStore");
const scoring   = require("./scoring");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Phục vụ ảnh câu hỏi
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use("/assets", express.static(path.join(PUBLIC_DIR, "assets")));

// Phục vụ frontend build (production)
const DIST_DIR = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}

// ─── Helper: strip correctOptionId from question for quiz (active session) ──
function stripQuestion(q) {
  const { correctOptionId, explanation, sourceText, ...safe } = q;
  return safe;
}

// ─── API Routes ───────────────────────────────────────────────────────────

// GET /api/metadata
app.get("/api/metadata", (req, res) => {
  try {
    const { db } = dataStore.getQuestionMaps();
    const standards = [...new Set(db.questions.map((q) => q.standard).filter(Boolean))];
    const blooms    = [...new Set(db.questions.map((q) => q.bloomLevel).filter(Boolean))];
    res.json({
      questionCount: db.questions.length,
      sectionCount:  db.sections.length,
      standards,
      bloomLevels: blooms,
      importedAt: db.source.importedAt,
      sha256: db.source.sha256,
    });
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// GET /api/sections
app.get("/api/sections", (req, res) => {
  try {
    const { db } = dataStore.getQuestionMaps();
    res.json(db.sections);
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// GET /api/questions?ids=Q001,Q002 (luôn ẩn correctOptionId và explanation vì lý do bảo mật)
app.get("/api/questions", (req, res) => {
  try {
    const { db, qMap } = dataStore.getQuestionMaps();
    const { ids } = req.query;
    
    let questions = db.questions;
    if (ids) {
      const idList = ids.split(",").map((s) => s.trim());
      questions = idList.map((id) => qMap[id]).filter(Boolean);
    }
    
    res.json(questions.map(stripQuestion));
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// POST /api/sessions – Tạo phiên mới
app.post("/api/sessions", (req, res) => {
  try {
    const { mode, sectionIds, filters } = req.body;
    if (!mode) return res.status(400).json({ error: "mode is required" });

    let questionOrder = [];

    if (mode === "sequential") {
      // Lấy câu hỏi tuần tự theo section
      const { db } = dataStore.getQuestionMaps();
      if (sectionIds && sectionIds.length > 0) {
        const secSet = new Set(sectionIds);
        questionOrder = db.questions
          .filter((q) => secSet.has(q.sectionId))
          .sort((a, b) => a.order - b.order)
          .map((q) => q.id);
      } else {
        questionOrder = db.questions
          .sort((a, b) => a.order - b.order)
          .map((q) => q.id);
      }
    } else if (mode === "shuffled") {
      questionOrder = scoring.buildShuffledOrder(filters || {});
    } else {
      return res.status(400).json({ error: "mode phải là 'sequential' hoặc 'shuffled'" });
    }

    if (questionOrder.length === 0) {
      return res.status(400).json({ error: "Không có câu hỏi nào phù hợp với bộ lọc" });
    }

    const now = new Date().toISOString();
    const session = {
      id:              uuidv4(),
      status:          "in_progress",
      mode,
      startedAt:       now,
      completedAt:     null,
      sectionIds:      sectionIds || [],
      filters:         filters || {},
      questionOrder,
      answers:         {},
      markedQuestionIds: [],
      correctCount:    0,
      wrongCount:      0,
      unansweredCount: questionOrder.length,
      scorePercent:    0,
      durationSeconds: 0,
    };

    const history = dataStore.getHistory();
    history.sessions.push(session);
    dataStore.saveHistory(history);

    res.status(201).json(session);
  } catch (e) {
    console.error("[POST /api/sessions]", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/in-progress
app.get("/api/sessions/in-progress", (req, res) => {
  const history = dataStore.getHistory();
  const active = history.sessions
    .filter((s) => s.status === "in_progress")
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  res.json(active);
});

// GET /api/sessions/recent?limit=5
app.get("/api/sessions/recent", (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const history = dataStore.getHistory();
  const completed = history.sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, limit);
  res.json(completed);
});

// GET /api/sessions – Tất cả sessions
app.get("/api/sessions", (req, res) => {
  const history = dataStore.getHistory();
  const all = [...history.sessions].sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );
  res.json(all);
});

// GET /api/sessions/:id
app.get("/api/sessions/:id", (req, res) => {
  const history = dataStore.getHistory();
  const session = history.sessions.find((s) => s.id === req.params.id);
  if (!session) return res.status(404).json({ error: "Session không tồn tại" });
  res.json(session);
});

// GET /api/sessions/:id/questions – trả về câu hỏi đầy đủ (chỉ khi session đã completed)
app.get("/api/sessions/:id/questions", (req, res) => {
  try {
    const history = dataStore.getHistory();
    const session = history.sessions.find((s) => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: "Session không tồn tại" });
    if (session.status !== "completed") {
      return res.status(403).json({ error: "Chỉ được xem đáp án sau khi hoàn thành bài thi" });
    }
    const { qMap } = dataStore.getQuestionMaps();
    const questions = session.questionOrder.map((id) => qMap[id]).filter(Boolean);
    res.json(questions);
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// PATCH /api/sessions/:id/answers – Lưu đáp án
app.patch("/api/sessions/:id/answers", (req, res) => {
  try {
    const history = dataStore.getHistory();
    const idx = history.sessions.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Session không tồn tại" });

    const session = history.sessions[idx];
    if (session.status === "completed") {
      return res.status(403).json({ error: "Bài đã nộp, không thể thay đổi đáp án" });
    }

    const { answers, durationSeconds } = req.body;
    if (answers) {
      // Chỉ cho phép trả lời những câu trong questionOrder
      const allowed = new Set(session.questionOrder);
      for (const [qid, ans] of Object.entries(answers)) {
        if (allowed.has(qid) && ["A","B","C","D"].includes(ans)) {
          session.answers[qid] = ans;
        }
      }
    }
    if (durationSeconds !== undefined) {
      session.durationSeconds = durationSeconds;
    }

    history.sessions[idx] = session;
    dataStore.saveHistory(history);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/sessions/:id/marks – Đánh dấu câu hỏi
app.patch("/api/sessions/:id/marks", (req, res) => {
  try {
    const history = dataStore.getHistory();
    const idx = history.sessions.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Session không tồn tại" });

    const session = history.sessions[idx];
    if (session.status === "completed") {
      return res.status(403).json({ error: "Bài đã nộp" });
    }

    const { markedQuestionIds } = req.body;
    if (Array.isArray(markedQuestionIds)) {
      session.markedQuestionIds = markedQuestionIds.filter((id) =>
        session.questionOrder.includes(id)
      );
    }

    history.sessions[idx] = session;
    dataStore.saveHistory(history);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sessions/:id/submit – Nộp bài
app.post("/api/sessions/:id/submit", (req, res) => {
  try {
    const history = dataStore.getHistory();
    const idx = history.sessions.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Session không tồn tại" });

    const session = history.sessions[idx];
    if (session.status === "completed") {
      return res.json(session); // Idempotent
    }

    const { durationSeconds } = req.body;
    if (durationSeconds !== undefined) session.durationSeconds = durationSeconds;

    // Tính điểm phía server
    const { correctCount, wrongCount, unansweredCount, scorePercent } =
      scoring.scoreSession(session);

    session.status          = "completed";
    session.completedAt     = new Date().toISOString();
    session.correctCount    = correctCount;
    session.wrongCount      = wrongCount;
    session.unansweredCount = unansweredCount;
    session.scorePercent    = scorePercent;

    history.sessions[idx] = session;
    dataStore.saveHistory(history);
    res.json(session);
  } catch (e) {
    console.error("[POST /api/sessions/:id/submit]", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sessions/:id/retry-wrong – Làm lại câu sai
app.post("/api/sessions/:id/retry-wrong", (req, res) => {
  try {
    const history = dataStore.getHistory();
    const src = history.sessions.find((s) => s.id === req.params.id);
    if (!src) return res.status(404).json({ error: "Session không tồn tại" });
    if (src.status !== "completed") {
      return res.status(400).json({ error: "Bài chưa được nộp" });
    }

    const wrongIds = scoring.getWrongQuestionIds(src);
    if (wrongIds.length === 0) {
      return res.status(400).json({ error: "Không có câu sai để luyện lại" });
    }

    const now = new Date().toISOString();
    const newSession = {
      id:              uuidv4(),
      status:          "in_progress",
      mode:            "shuffled",
      startedAt:       now,
      completedAt:     null,
      sectionIds:      [],
      filters:         { retryFrom: src.id },
      questionOrder:   scoring.shuffleArray(wrongIds),
      answers:         {},
      markedQuestionIds: [],
      correctCount:    0,
      wrongCount:      0,
      unansweredCount: wrongIds.length,
      scorePercent:    0,
      durationSeconds: 0,
    };

    history.sessions.push(newSession);
    dataStore.saveHistory(history);
    res.status(201).json(newSession);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Fallback: serve index.html for SPA (production) ─────────────────────
app.get("*", (req, res) => {
  const indexPath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(
      `<h2>HVAC Quiz Server đang chạy tại cổng ${PORT}</h2>
       <p>Frontend chưa được build. Chạy: <code>npm run build</code> hoặc <code>npm run dev</code></p>`
    );
  }
});

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  HVAC Quiz Server đang chạy: http://localhost:${PORT}\n`);
  // Kiểm tra questions.json
  try {
    const { db } = dataStore.getQuestionMaps();
    console.log(`  Dữ liệu: ${db.questions.length} câu hỏi, ${db.sections.length} phần\n`);
  } catch (e) {
    console.warn(`  CẢNH BÁO: ${e.message}\n`);
  }
});

module.exports = app; // cho tests
