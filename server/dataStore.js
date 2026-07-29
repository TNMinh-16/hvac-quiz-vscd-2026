/**
 * dataStore.js – Đọc/ghi JSON an toàn
 * Sử dụng ghi file tạm + rename để tránh mất dữ liệu
 */
const fs   = require("fs");
const path = require("path");

const DEFAULT_DATA_DIR = path.join(__dirname, "..", "data");
let currentDataDir = process.env.HVAC_DATA_DIR ? path.resolve(process.env.HVAC_DATA_DIR) : DEFAULT_DATA_DIR;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDir(currentDataDir);

function getDataDir() {
  return currentDataDir;
}

function setDataDir(dir) {
  currentDataDir = path.resolve(dir);
  _questionsCache = null;
  ensureDir(currentDataDir);
}

function getPath(filename) {
  ensureDir(currentDataDir);
  if (filename === "questions.json") {
    const custom = path.join(currentDataDir, "questions.json");
    if (fs.existsSync(custom)) return custom;
    return path.join(DEFAULT_DATA_DIR, "questions.json");
  }
  return path.join(currentDataDir, filename);
}

// ─── Read helpers ─────────────────────────────────────────────────────────
function readJson(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[dataStore] Cannot parse ${filePath}:`, err.message);
    const backup = filePath + ".corrupt." + Date.now();
    try { fs.copyFileSync(filePath, backup); } catch {}
    console.error(`  Backup saved to ${backup}`);
    return defaultValue;
  }
}

// ─── Safe write ───────────────────────────────────────────────────────────
function writeJson(filePath, data) {
  const tmp = filePath + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    console.error(`[dataStore] Cannot write ${filePath}:`, err.message);
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

// ─── Questions (read-only after import) ──────────────────────────────────
let _questionsCache = null;

function getQuestions() {
  if (_questionsCache) return _questionsCache;
  const filePath = getPath("questions.json");
  const data = readJson(filePath, null);
  if (!data) {
    throw new Error(
      "data/questions.json chưa được tạo. Chạy: python scripts/import_docx.py"
    );
  }
  _questionsCache = data;
  return _questionsCache;
}

// Build lookup maps
function getQuestionMaps() {
  const db = getQuestions();
  const qMap  = {};
  const sMap  = {};
  for (const q of db.questions)  qMap[q.id] = q;
  for (const s of db.sections)   sMap[s.id] = s;
  return { db, qMap, sMap };
}

// ─── History ──────────────────────────────────────────────────────────────
const DEFAULT_HISTORY = { schemaVersion: 1, sessions: [] };

function getHistory() {
  return readJson(getPath("history.json"), { ...DEFAULT_HISTORY, sessions: [] });
}

function saveHistory(history) {
  writeJson(getPath("history.json"), history);
}

// ─── Settings ─────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  schemaVersion: 1,
  language: "bilingual",
  theme: "light",
};

function getSettings() {
  return readJson(getPath("settings.json"), DEFAULT_SETTINGS);
}

function saveSettings(settings) {
  writeJson(getPath("settings.json"), settings);
}

module.exports = {
  getQuestions,
  getQuestionMaps,
  getHistory,
  saveHistory,
  getSettings,
  saveSettings,
  getDataDir,
  setDataDir,
};
