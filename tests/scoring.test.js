/**
 * tests/scoring.test.js
 * Kiểm tra tính điểm, xáo trộn, session management
 */
const { scoreSession, getWrongQuestionIds, shuffleArray, buildShuffledOrder } = require("../server/scoring");

// Mock dataStore
jest.mock("../server/dataStore", () => ({
  getQuestionMaps: () => ({
    db: {
      questions: [
        { id: "Q001", order: 1, correctOptionId: "A", sectionId: "sec-1", standard: "ASHRAE 55", bloomLevel: "Remember" },
        { id: "Q002", order: 2, correctOptionId: "B", sectionId: "sec-1", standard: "ASHRAE 55", bloomLevel: "Remember" },
        { id: "Q003", order: 3, correctOptionId: "C", sectionId: "sec-2", standard: "ASHRAE 52.2", bloomLevel: "Understand" },
        { id: "Q004", order: 4, correctOptionId: "D", sectionId: "sec-2", standard: "ASHRAE 52.2", bloomLevel: "Apply" },
        { id: "Q005", order: 5, correctOptionId: "A", sectionId: "sec-3", standard: "ASHRAE 90.1", bloomLevel: "Apply" },
      ],
    },
    qMap: {
      Q001: { id: "Q001", correctOptionId: "A" },
      Q002: { id: "Q002", correctOptionId: "B" },
      Q003: { id: "Q003", correctOptionId: "C" },
      Q004: { id: "Q004", correctOptionId: "D" },
      Q005: { id: "Q005", correctOptionId: "A" },
    },
    sMap: {
      "sec-1": { id: "sec-1" },
      "sec-2": { id: "sec-2" },
      "sec-3": { id: "sec-3" },
    },
  }),
}));

describe("scoreSession", () => {
  test("tất cả đúng → 100%", () => {
    const session = {
      questionOrder: ["Q001", "Q002", "Q003"],
      answers: { Q001: "A", Q002: "B", Q003: "C" },
    };
    const result = scoreSession(session);
    expect(result.correctCount).toBe(3);
    expect(result.wrongCount).toBe(0);
    expect(result.unansweredCount).toBe(0);
    expect(result.scorePercent).toBe(100);
  });

  test("tất cả sai → 0%", () => {
    const session = {
      questionOrder: ["Q001", "Q002"],
      answers: { Q001: "B", Q002: "A" },
    };
    const result = scoreSession(session);
    expect(result.correctCount).toBe(0);
    expect(result.wrongCount).toBe(2);
    expect(result.scorePercent).toBe(0);
  });

  test("bỏ qua một câu", () => {
    const session = {
      questionOrder: ["Q001", "Q002", "Q003"],
      answers: { Q001: "A", Q002: "B" },
    };
    const result = scoreSession(session);
    expect(result.correctCount).toBe(2);
    expect(result.unansweredCount).toBe(1);
    expect(result.scorePercent).toBeCloseTo(66.7, 0);
  });

  test("không có câu nào → 0%", () => {
    const session = { questionOrder: ["Q001"], answers: {} };
    const result = scoreSession(session);
    expect(result.unansweredCount).toBe(1);
    expect(result.scorePercent).toBe(0);
  });
});

describe("getWrongQuestionIds", () => {
  test("trả về đúng câu sai", () => {
    const session = {
      questionOrder: ["Q001", "Q002", "Q003"],
      answers: { Q001: "A", Q002: "A", Q003: "C" }, // Q002 sai (đúng là B)
    };
    const wrong = getWrongQuestionIds(session);
    expect(wrong).toEqual(["Q002"]);
  });

  test("không có câu sai", () => {
    const session = {
      questionOrder: ["Q001", "Q002"],
      answers: { Q001: "A", Q002: "B" },
    };
    expect(getWrongQuestionIds(session)).toHaveLength(0);
  });
});

describe("shuffleArray (Fisher-Yates)", () => {
  test("giữ nguyên số phần tử", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffleArray(arr);
    expect(shuffled).toHaveLength(arr.length);
  });

  test("chứa tất cả phần tử gốc", () => {
    const arr = ["A", "B", "C", "D", "E"];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  test("không thay đổi mảng gốc", () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(copy);
  });

  test("không lặp câu khi xáo trộn", () => {
    const arr = ["Q001", "Q002", "Q003", "Q004", "Q005"];
    const shuffled = shuffleArray(arr);
    const unique = [...new Set(shuffled)];
    expect(unique).toHaveLength(shuffled.length);
  });
});

describe("buildShuffledOrder", () => {
  test("không filter → tất cả 5 câu", () => {
    const order = buildShuffledOrder({});
    expect(order).toHaveLength(5);
    expect([...new Set(order)]).toHaveLength(5);
  });

  test("filter theo standard", () => {
    const order = buildShuffledOrder({ standard: "55" });
    expect(order).toHaveLength(2); // Q001, Q002
  });

  test("filter theo bloomLevel", () => {
    const order = buildShuffledOrder({ bloomLevel: "Apply" });
    expect(order).toHaveLength(2); // Q004, Q005
  });

  test("giới hạn số câu", () => {
    const order = buildShuffledOrder({ count: 3 });
    expect(order).toHaveLength(3);
  });

  test("không có câu trùng trong một lần", () => {
    const order = buildShuffledOrder({});
    const unique = [...new Set(order)];
    expect(unique).toHaveLength(order.length);
  });
});
