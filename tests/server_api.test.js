/**
 * tests/server_api.test.js
 * Integration tests cho Express API
 * Server được start/stop tự động trong suite
 */
const http = require("http");
const path = require("path");
const fs   = require("fs");

const TEST_PORT = 3099; // Port riêng cho test
const BASE = `http://localhost:${TEST_PORT}`;
const TEST_DATA_DIR = path.join(__dirname, "..", "data", ".test_api_tmp");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => req.destroy(new Error("timeout")));
  });
}

function httpMethod(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const parsed = new URL(url);
    const opts = {
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = http.request(opts, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.setTimeout(8000, () => req.destroy(new Error("timeout")));
    if (payload) req.write(payload);
    req.end();
  });
}

const httpPost  = (url, body) => httpMethod("POST", url, body);
const httpPatch = (url, body) => httpMethod("PATCH", url, body);

// ─── Setup ────────────────────────────────────────────────────────────────────
let serverInstance;

beforeAll(done => {
  process.env.PORT = String(TEST_PORT);
  process.env.HVAC_DATA_DIR = TEST_DATA_DIR;
  if (!fs.existsSync(TEST_DATA_DIR)) fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

  // Clear module cache để đảm bảo PORT và HVAC_DATA_DIR mới được dùng
  Object.keys(require.cache)
    .filter(k => k.includes("server"))
    .forEach(k => delete require.cache[k]);

  // Redirect console để giảm noise
  const app = require("../server/index");
  serverInstance = app.server;
  setTimeout(done, 1500);
}, 10000);

afterAll(done => {
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  } catch {}
  if (serverInstance && serverInstance.close) {
    serverInstance.close(() => done());
  } else {
    done();
  }
}, 5000);

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("Server API", () => {
  test("GET /api/health – trả về healthy và đúng 439 câu hỏi", async () => {
    const res = await httpGet(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.questionCount).toBe(439);
  });

  test("GET /api/metadata – 439 câu, có standards", async () => {
    const res = await httpGet(`${BASE}/api/metadata`);
    expect(res.status).toBe(200);
    expect(res.body.questionCount).toBe(439);
    expect(Array.isArray(res.body.standards)).toBe(true);
    expect(res.body.standards.length).toBeGreaterThan(0);
  });

  test("GET /api/sections – trả về danh sách sections", async () => {
    const res = await httpGet(`${BASE}/api/sections`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("GET /api/questions – ẩn correctOptionId và explanation", async () => {
    const res = await httpGet(`${BASE}/api/questions`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(439);
    // correctOptionId và explanation phải bị ẩn
    for (const q of res.body.slice(0, 20)) {
      expect(q.correctOptionId).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  test("GET /api/questions?full=true – vẫn bị ẩn correctOptionId để bảo mật", async () => {
    const res = await httpGet(`${BASE}/api/questions?full=true`);
    expect(res.status).toBe(200);
    for (const q of res.body.slice(0, 10)) {
      expect(q.correctOptionId).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });

  test("POST /api/sessions – sequential 439 câu theo thứ tự", async () => {
    const res = await httpPost(`${BASE}/api/sessions`, { mode: "sequential" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe("in_progress");
    expect(res.body.mode).toBe("sequential");
    expect(res.body.questionOrder).toHaveLength(439);
    // Thứ tự phải từ Q001 đến Q439 (tuần tự)
    expect(res.body.questionOrder[0]).toBe("Q001");
    expect(res.body.questionOrder[438]).toBe("Q439");
  });

  test("POST /api/sessions – shuffled count=10, không trùng câu", async () => {
    const res = await httpPost(`${BASE}/api/sessions`, {
      mode: "shuffled",
      filters: { count: 10 },
    });
    expect(res.status).toBe(201);
    expect(res.body.questionOrder).toHaveLength(10);
    const unique = [...new Set(res.body.questionOrder)];
    expect(unique).toHaveLength(10);
  });

  test("POST /api/sessions – mode không hợp lệ → 400", async () => {
    const res = await httpPost(`${BASE}/api/sessions`, { mode: "invalid" });
    expect(res.status).toBe(400);
  });

  test("GET /api/sessions/recent?limit=5 – tối đa 5", async () => {
    const res = await httpGet(`${BASE}/api/sessions/recent?limit=5`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(5);
    // Tất cả phải là completed
    for (const s of res.body) {
      expect(s.status).toBe("completed");
    }
  });

  test("Submit flow đầy đủ: tạo → trả lời → nộp → không thể sửa", async () => {
    // 1. Tạo session 5 câu
    const createRes = await httpPost(`${BASE}/api/sessions`, {
      mode: "shuffled",
      filters: { count: 5 },
    });
    const sid    = createRes.body.id;
    const qOrder = createRes.body.questionOrder;
    expect(qOrder).toHaveLength(5);

    // 2. Lưu đáp án
    const answers = Object.fromEntries(qOrder.map(qid => [qid, "A"]));
    const patchRes = await httpPatch(`${BASE}/api/sessions/${sid}/answers`, {
      answers,
      durationSeconds: 60,
    });
    expect(patchRes.status).toBe(200);

    // Kiểm tra bảo mật: trước khi nộp bài không được xem đáp án từ endpoint session questions (403)
    const secureCheckBefore = await httpGet(`${BASE}/api/sessions/${sid}/questions`);
    expect(secureCheckBefore.status).toBe(403);

    // 3. Nộp bài
    const submitRes = await httpPost(`${BASE}/api/sessions/${sid}/submit`, {
      durationSeconds: 65,
    });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe("completed");
    expect(typeof submitRes.body.scorePercent).toBe("number");
    const total = submitRes.body.correctCount + submitRes.body.wrongCount + submitRes.body.unansweredCount;
    expect(total).toBe(5);

    // Sau khi đã nộp bài → được phép lấy câu hỏi kèm đáp án từ endpoint session questions (200)
    const secureCheckAfter = await httpGet(`${BASE}/api/sessions/${sid}/questions`);
    expect(secureCheckAfter.status).toBe(200);
    expect(secureCheckAfter.body).toHaveLength(5);
    expect(secureCheckAfter.body[0].correctOptionId).toBeDefined();

    // 4. Bài đã nộp → không thể thay đổi đáp án (403)
    const retryPatch = await httpPatch(`${BASE}/api/sessions/${sid}/answers`, {
      answers: { [qOrder[0]]: "B" },
      durationSeconds: 70,
    });
    expect(retryPatch.status).toBe(403);

    // 5. Nộp lại idempotent
    const submitAgain = await httpPost(`${BASE}/api/sessions/${sid}/submit`, { durationSeconds: 70 });
    expect(submitAgain.status).toBe(200);
    expect(submitAgain.body.status).toBe("completed");
  });

  test("GET /api/sessions – lịch sử vẫn tồn tại", async () => {
    const res = await httpGet(`${BASE}/api/sessions`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("5 lần gần nhất sắp xếp mới nhất trước", async () => {
    const res = await httpGet(`${BASE}/api/sessions/recent?limit=5`);
    const sessions = res.body;
    for (let i = 1; i < sessions.length; i++) {
      const prev = new Date(sessions[i - 1].completedAt).getTime();
      const cur  = new Date(sessions[i].completedAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  test("API từ chối ID và mode không hợp lệ", async () => {
    const badId = await httpGet(`${BASE}/api/sessions/invalid_id_w_symbols;drop table`);
    expect(badId.status).toBe(400);

    const badMode = await httpPost(`${BASE}/api/sessions`, { mode: "hack_mode" });
    expect(badMode.status).toBe(400);
  });
});

