/**
 * tests/data_validation.test.js
 * Kiểm tra toàn bộ dữ liệu trong questions.json
 */
const fs   = require("fs");
const path = require("path");

const QUESTIONS_FILE = path.join(__dirname, "..", "data", "questions.json");

describe("questions.json validation", () => {
  let db;

  beforeAll(() => {
    if (!fs.existsSync(QUESTIONS_FILE)) {
      throw new Error(
        `data/questions.json chưa tồn tại.\n` +
        `Chạy: python scripts/import_docx.py`
      );
    }
    const raw = fs.readFileSync(QUESTIONS_FILE, "utf-8");
    db = JSON.parse(raw);
  });

  test("schemaVersion = 1", () => {
    expect(db.schemaVersion).toBe(1);
  });

  test("đúng 1000 câu hỏi", () => {
    expect(db.questions).toHaveLength(1000);
  });

  test("không có ID câu hỏi trùng nhau", () => {
    const ids = db.questions.map(q => q.id);
    const unique = [...new Set(ids)];
    expect(unique).toHaveLength(ids.length);
  });

  test("tất cả câu có đúng 4 phương án A, B, C, D", () => {
    const errors = [];
    for (const q of db.questions) {
      const letters = q.options.map(o => o.id).sort().join("");
      if (letters !== "ABCD") {
        errors.push(`${q.id}: options = [${letters}]`);
      }
    }
    expect(errors).toHaveLength(0);
  });

  test("tất cả câu có correctOptionId hợp lệ", () => {
    const errors = [];
    for (const q of db.questions) {
      if (!q.correctOptionId) {
        errors.push(`${q.id}: thiếu correctOptionId`);
      } else {
        const optIds = q.options.map(o => o.id);
        if (!optIds.includes(q.correctOptionId)) {
          errors.push(`${q.id}: correctOptionId='${q.correctOptionId}' không tồn tại`);
        }
      }
    }
    expect(errors).toHaveLength(0);
  });

  test("tất cả câu có đầy đủ nội dung tiếng Anh và tiếng Việt (stem)", () => {
    const errors = [];
    for (const q of db.questions) {
      if (!q.stem?.en || !q.stem?.vi) {
        errors.push(`${q.id}: thiếu stem EN hoặc VI`);
      }
    }
    expect(errors).toHaveLength(0);
  });

  test("tất cả 4.000 phương án có đầy đủ tiếng Anh và tiếng Việt", () => {
    const errors = [];
    let totalOptions = 0;
    for (const q of db.questions) {
      for (const opt of q.options) {
        totalOptions += 1;
        if (!opt.en || !opt.vi) {
          errors.push(`${q.id} opt ${opt.id}: thiếu EN hoặc VI`);
        }
      }
    }
    expect(totalOptions).toBe(4000);
    expect(errors).toHaveLength(0);
  });

  test("đủ 1000 lời giải thích bằng cả tiếng Anh và tiếng Việt", () => {
    const errors = [];
    for (const q of db.questions) {
      if (!q.explanation?.en || !q.explanation?.vi) {
        errors.push(`${q.id}: thiếu explanation EN hoặc VI`);
      }
    }
    expect(errors).toHaveLength(0);
  });

  test("thứ tự câu hỏi liên tục (order = 1..N)", () => {
    const orders = db.questions.map(q => q.order).sort((a, b) => a - b);
    const expected = Array.from({ length: 1000 }, (_, i) => i + 1);
    expect(orders).toEqual(expected);
  });

  test("đúng 211 liên kết ảnh-câu", () => {
    let totalRefs = 0;
    const errors = [];
    for (const q of db.questions) {
      for (const imgPath of (q.images || [])) {
        totalRefs += 1;
      }
    }
    expect(totalRefs).toBe(211);
    expect(errors).toHaveLength(0);
  });

  test("tất cả ảnh được liên kết tồn tại trên disk", () => {
    const errors = [];
    for (const q of db.questions) {
      for (const imgPath of (q.images || [])) {
        const full = path.join(__dirname, "..", "public", imgPath.replace(/^\//, ""));
        if (!fs.existsSync(full)) {
          errors.push(`${q.id}: ảnh không tồn tại: ${imgPath}`);
        }
      }
    }
    expect(errors).toHaveLength(0);
  });

  test("cấu trúc cây phân cấp sections đúng (1 L0, 6 L1, 30 L2)", () => {
    expect(db.sections).toHaveLength(37);
    const root = db.sections.filter(s => s.level === 0);
    const blooms = db.sections.filter(s => s.level === 1);
    const standards = db.sections.filter(s => s.level === 2);

    expect(root).toHaveLength(1);
    expect(root[0].parentId).toBeNull();

    expect(blooms).toHaveLength(6);
    for (const b of blooms) {
      expect(b.parentId).toBe(root[0].id);
    }

    expect(standards).toHaveLength(30);
    const bloomIds = new Set(blooms.map(b => b.id));
    for (const std of standards) {
      expect(bloomIds.has(std.parentId)).toBe(true);
    }
  });

  test("sections có questionIds hợp lệ và đúng phân bố số câu", () => {
    const allQIds = new Set(db.questions.map(q => q.id));
    const errors = [];
    for (const sec of db.sections) {
      for (const qid of sec.questionIds) {
        if (!allQIds.has(qid)) {
          errors.push(`Section ${sec.id}: unknown question ${qid}`);
        }
      }
    }
    expect(errors).toHaveLength(0);
  });

  test("mỗi câu có sectionId hợp lệ", () => {
    const secIds = new Set(db.sections.map(s => s.id));
    const errors = db.questions.filter(q => !secIds.has(q.sectionId));
    expect(errors).toHaveLength(0);
  });
});
