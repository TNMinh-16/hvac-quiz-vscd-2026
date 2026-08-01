/**
 * index.js – Express server cho HVAC Quiz ASHRAE VSCD 2026
 *
 * PORT: Cấu hình qua biến môi trường PORT (mặc định 3000), bind 0.0.0.0
 * Tất cả API tại /api/...
 * Static files tại /assets/... (từ public/assets/)
 * Chờ Hỗ trợ cắm nóng Cloud PostgreSQL / Local JSON qua sessionStore.js
 */

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const compression  = require("compression");
const rateLimit    = require("express-rate-limit");
const path         = require("path");
const fs           = require("fs");
const { v4: uuidv4 } = require("uuid");

const dataStore    = require("./dataStore");
const sessionStore = require("./sessionStore");
const scoring      = require("./scoring");

const app  = express();
const PORT = process.env.PORT || 3000;
const isTestEnv = process.env.NODE_ENV === "test" || process.env.HVAC_DATA_DIR;

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));
app.use(compression());
app.use(cors({
  origin: process.env.APP_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

// Header chống index (do đây là web ôn tập cá nhân)
app.use((req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: isTestEnv ? 10000 : 2500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều lượt truy cập, vui lòng thử lại sau chút." }
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 5000 : 800, // Đủ mượt mà cho autosave 1.5s liên tục trong nhiều giờ
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu ghi dữ liệu, vui lòng chậm lại." }
});

app.use("/api/", generalLimiter);

// Phục vụ ảnh câu hỏi tĩnh (có cache 24h)
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use("/assets", express.static(path.join(PUBLIC_DIR, "assets"), { maxAge: "1d" }));

// Phục vụ frontend build (production, cache 24h cho tĩnh)
const DIST_DIR = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: "1d", setHeaders: (res, fp) => {
    if (fp.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  }}));
}

// ─── Helper: Validate params & IDs ───────────────────────────────────────
function isValidId(id) {
  return typeof id === "string" && id.length >= 8 && id.length <= 128 && !/['";]/.test(id);
}

// ─── Helper: strip correctOptionId from question for quiz (active session) ──
function stripQuestion(q) {
  const { correctOptionId, explanation, sourceText, ...safe } = q;
  return safe;
}

// ─── API Routes ───────────────────────────────────────────────────────────

// GET /api/health – Kiểm tra trạng thái máy chủ & CSDL
app.get("/api/health", async (req, res) => {
  try {
    const dbStatus = await sessionStore.checkHealth();
    let questionCount = 0;
    try {
      const { db } = dataStore.getQuestionMaps();
      questionCount = db.questions.length;
    } catch (e) {
      // lỗi đọc file questions
    }
    const isHealthy = dbStatus.status === "ok" && questionCount === 379;
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "healthy" : "unhealthy",
      backend: dbStatus.backend,
      database: dbStatus.status,
      questionCount,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(503).json({ status: "unhealthy", error: "Health check exception" });
  }
});

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

// GET /api/questions?ids=Q001,Q002 (luôn ẩn correctOptionId và explanation)
app.get("/api/questions", (req, res) => {
  try {
    const { db, qMap } = dataStore.getQuestionMaps();
    const { ids } = req.query;
    
    let questions = db.questions;
    if (ids) {
      if (typeof ids !== "string" || ids.length > 3000) {
        return res.status(400).json({ error: "Tham số ids không hợp lệ hoặc quá dài" });
      }
      const idList = ids.split(",").map((s) => s.trim());
      questions = idList.map((id) => qMap[id]).filter(Boolean);
    }
    
    res.json(questions.map(stripQuestion));
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// POST /api/sessions – Tạo phiên mới
app.post("/api/sessions", writeLimiter, async (req, res) => {
  try {
    const { mode, sectionIds, filters } = req.body;
    if (!mode) return res.status(400).json({ error: "mode is required" });
    if (!["sequential", "shuffled"].includes(mode)) {
      return res.status(400).json({ error: "mode phải là 'sequential' hoặc 'shuffled'" });
    }

    let questionOrder = [];
    const { db } = dataStore.getQuestionMaps();

    if (mode === "sequential") {
      if (sectionIds && Array.isArray(sectionIds) && sectionIds.length > 0) {
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
      sectionIds:      Array.isArray(sectionIds) ? sectionIds : [],
      filters:         filters && typeof filters === "object" ? filters : {},
      questionOrder,
      answers:         {},
      markedQuestionIds: [],
      correctCount:    0,
      wrongCount:      0,
      unansweredCount: questionOrder.length,
      scorePercent:    0,
      durationSeconds: 0,
    };

    const saved = await sessionStore.createSession(session);
    res.status(201).json(saved);
  } catch (e) {
    console.error("[POST /api/sessions]", e.message);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Không thể tạo bài làm" : e.message });
  }
});

// GET /api/sessions/in-progress
app.get("/api/sessions/in-progress", async (req, res) => {
  try {
    const active = await sessionStore.getInProgressSessions();
    res.json(active);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/recent?limit=5
app.get("/api/sessions/recent", async (req, res) => {
  try {
    let limit = parseInt(req.query.limit) || 5;
    if (limit <= 0 || limit > 50) limit = 5;
    const completed = await sessionStore.getRecentCompletedSessions(limit);
    res.json(completed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions – Tất cả sessions (hỗ trợ phân trang)
app.get("/api/sessions", async (req, res) => {
  try {
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 500;
    const all = await sessionStore.getAllSessions(page, limit);
    res.json(all);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:id
app.get("/api/sessions/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: "ID không hợp lệ" });
    const session = await sessionStore.getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: "Session không tồn tại" });
    res.json(session);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sessions/:id/questions – trả về câu hỏi đầy đủ (chỉ khi session đã completed)
app.get("/api/sessions/:id/questions", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: "ID không hợp lệ" });
    const session = await sessionStore.getSessionById(req.params.id);
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

// PATCH /api/sessions/:id/answers – Lưu đáp án (Autosave với atomic JSONB merge)
app.patch("/api/sessions/:id/answers", writeLimiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: "ID không hợp lệ" });
    const { answers, durationSeconds } = req.body;
    if (answers && typeof answers !== "object") {
      return res.status(400).json({ error: "Định dạng answers không hợp lệ" });
    }

    const result = await sessionStore.saveAnswers(req.params.id, answers, durationSeconds);
    if (!result.ok) {
      if (result.error && result.error.includes("không tồn tại")) {
        return res.status(404).json({ error: result.error });
      }
      return res.status(403).json({ error: result.error || "Không thể lưu đáp án" });
    }
    res.json({ ok: true, session: result.session });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/sessions/:id/marks – Đánh dấu câu hỏi
app.patch("/api/sessions/:id/marks", writeLimiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: "ID không hợp lệ" });
    const { markedQuestionIds } = req.body;
    if (markedQuestionIds && !Array.isArray(markedQuestionIds)) {
      return res.status(400).json({ error: "markedQuestionIds phải là một mảng" });
    }

    const result = await sessionStore.saveMarks(req.params.id, markedQuestionIds);
    if (!result.ok) {
      if (result.error && result.error.includes("không tồn tại")) {
        return res.status(404).json({ error: result.error });
      }
      return res.status(403).json({ error: result.error });
    }
    res.json({ ok: true, session: result.session });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sessions/:id/submit – Nộp bài (Idempotent)
app.post("/api/sessions/:id/submit", writeLimiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: "ID không hợp lệ" });
    const existing = await sessionStore.getSessionById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Session không tồn tại" });

    if (existing.status === "completed") {
      return res.json(existing); // Idempotent
    }

    const { durationSeconds } = req.body;
    if (durationSeconds !== undefined) existing.durationSeconds = durationSeconds;

    const scored = scoring.scoreSession(existing);
    const result = await sessionStore.submitSession(existing.id, {
      correctCount: scored.correctCount,
      wrongCount: scored.wrongCount,
      unansweredCount: scored.unansweredCount,
      scorePercent: scored.scorePercent,
      durationSeconds: existing.durationSeconds,
    });

    if (!result.ok) {
      return res.status(result.code || 500).json({ error: result.error });
    }
    res.json(result.session);
  } catch (e) {
    console.error("[POST /api/sessions/:id/submit]", e.message);
    res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Lỗi khi nộp bài" : e.message });
  }
});

// POST /api/sessions/:id/retry-wrong – Làm lại câu sai
app.post("/api/sessions/:id/retry-wrong", writeLimiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: "ID không hợp lệ" });
    const src = await sessionStore.getSessionById(req.params.id);
    if (!src) return res.status(404).json({ error: "Session không tồn tại" });
    if (src.status !== "completed") {
      return res.status(400).json({ error: "Bài chưa được nộp, hãy nộp trước khi luyện lại" });
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

    const saved = await sessionStore.createSession(newSession);
    res.status(201).json(saved);
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

// ─── Error handling middleware (production clean) ────────────────────────
app.use((err, req, res, next) => {
  console.error("[UnhandledError]", err.message);
  res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message });
});

// ─── Start & Graceful Shutdown ───────────────────────────────────────────
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  HVAC Quiz Server đang chạy: http://0.0.0.0:${PORT}\n`);
  try {
    const { db } = dataStore.getQuestionMaps();
    console.log(`  Dữ liệu: ${db.questions.length} câu hỏi, ${db.sections.length} phần\n`);
  } catch (e) {
    console.warn(`  CẢNH BÁO: ${e.message}\n`);
  }
});

app.server = server; // gán cho jest teadown

function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Đang tắt máy chủ an toàn...`);
  server.close(async () => {
    await sessionStore.closePool();
    console.log("Máy chủ đã đóng connection pool & tắt hoàn toàn.");
    process.exit(0);
  });
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = app; // cho tests
