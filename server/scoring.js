/**
 * scoring.js – Tính điểm và trả về kết quả phiên làm bài
 * Backend tự tính điểm, không tin số liệu từ client
 */

const { getQuestionMaps } = require("./dataStore");

/**
 * Chấm điểm một phiên làm bài đã nộp.
 * @param {object} session - Phiên làm bài (có questionOrder, answers)
 * @returns {{ correctCount, wrongCount, unansweredCount, scorePercent }}
 */
function scoreSession(session) {
  const { qMap } = getQuestionMaps();
  const { questionOrder, answers } = session;

  let correct = 0;
  let wrong   = 0;
  let unanswered = 0;

  for (const qid of questionOrder) {
    const q = qMap[qid];
    if (!q) continue;

    const answer = answers[qid];
    if (!answer) {
      unanswered++;
    } else if (answer === q.correctOptionId) {
      correct++;
    } else {
      wrong++;
    }
  }

  const total = questionOrder.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100 * 10) / 10 : 0;

  return { correctCount: correct, wrongCount: wrong, unansweredCount: unanswered, scorePercent };
}

/**
 * Trả về danh sách câu hỏi sai trong một phiên đã hoàn thành.
 */
function getWrongQuestionIds(session) {
  const { qMap } = getQuestionMaps();
  return session.questionOrder.filter((qid) => {
    const q = qMap[qid];
    if (!q) return false;
    const ans = session.answers[qid];
    return ans && ans !== q.correctOptionId;
  });
}

/**
 * Fisher-Yates shuffle (đúng thuật toán)
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Tạo danh sách câu hỏi theo filter cho mode xáo trộn.
 * @param {object} filters - { sectionIds?, standard?, bloomLevel?, count? }
 */
function buildShuffledOrder(filters = {}) {
  const { db } = getQuestionMaps();
  let questions = [...db.questions];

  if (filters.sectionIds && filters.sectionIds.length > 0) {
    questions = questions.filter((q) => filters.sectionIds.includes(q.sectionId));
  }
  if (filters.standard) {
    questions = questions.filter((q) =>
      q.standard && q.standard.toLowerCase().includes(filters.standard.toLowerCase())
    );
  }
  if (filters.bloomLevel) {
    questions = questions.filter((q) =>
      q.bloomLevel && q.bloomLevel.toLowerCase() === filters.bloomLevel.toLowerCase()
    );
  }

  // Xáo trộn
  const shuffled = shuffleArray(questions.map((q) => q.id));

  // Lấy số lượng
  const count = filters.count && filters.count > 0
    ? Math.min(filters.count, shuffled.length)
    : shuffled.length;

  return shuffled.slice(0, count);
}

module.exports = { scoreSession, getWrongQuestionIds, shuffleArray, buildShuffledOrder };
