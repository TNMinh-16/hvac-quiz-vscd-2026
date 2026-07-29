import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Language, QuizSession, Question } from '../types';
import { getSession, getQuestions, getSessionQuestions } from '../api';
import { bloomColor } from '../utils';

interface Props { lang: Language }

type Filter = 'all' | 'correct' | 'wrong' | 'unanswered' | 'marked';

export default function ReviewPage({ lang }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession]     = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [filter, setFilter]       = useState<Filter>('all');
  const [imgZoom, setImgZoom]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const s = await getSession(id!);
        setSession(s);
        // Fetch questions with full data (answers visible after completion)
        const qs = s.status === 'completed'
          ? await getSessionQuestions(s.id)
          : await getQuestions(s.questionOrder);
        const qMap = Object.fromEntries(qs.map(q => [q.id, q]));
        setQuestions(s.questionOrder.map(qid => qMap[qid]).filter(Boolean));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /><span>Đang tải lời giải...</span></div>;
  if (error)   return <div className="page container"><div className="error-box">{error}</div></div>;
  if (!session) return null;

  const qMap = Object.fromEntries(questions.map(q => [q.id, q]));

  function getStatus(qid: string): 'correct' | 'wrong' | 'unanswered' {
    const ans = session!.answers[qid];
    const q   = qMap[qid];
    if (!ans) return 'unanswered';
    return ans === q?.correctOptionId ? 'correct' : 'wrong';
  }

  const filtered = questions.filter(q => {
    const status = getStatus(q.id);
    const isMarked = session!.markedQuestionIds.includes(q.id);
    if (filter === 'all')        return true;
    if (filter === 'correct')    return status === 'correct';
    if (filter === 'wrong')      return status === 'wrong';
    if (filter === 'unanswered') return status === 'unanswered';
    if (filter === 'marked')     return isMarked;
    return true;
  });

  const correctCount    = questions.filter(q => getStatus(q.id) === 'correct').length;
  const wrongCount      = questions.filter(q => getStatus(q.id) === 'wrong').length;
  const unansweredCount = questions.filter(q => getStatus(q.id) === 'unanswered').length;
  const markedCount     = questions.filter(q => session!.markedQuestionIds.includes(q.id)).length;

  return (
    <div className="page">
      <div className="container">

        <div className="page-header">
          <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: '.75rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/result/${id}`)}>
              ← Kết quả
            </button>
          </div>
          <h1 className="page-title">🔍 Xem lại đáp án</h1>
          <p className="page-subtitle">Đáp án đúng, phương án đã chọn và lời giải chi tiết</p>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs" style={{ marginBottom: '1.5rem' }} role="tablist" aria-label="Lọc câu hỏi">
          {([
            { k: 'all',        label: `Tất cả (${questions.length})` },
            { k: 'correct',    label: `✅ Đúng (${correctCount})` },
            { k: 'wrong',      label: `❌ Sai (${wrongCount})` },
            { k: 'unanswered', label: `⬜ Bỏ qua (${unansweredCount})` },
            { k: 'marked',     label: `🔖 Đánh dấu (${markedCount})` },
          ] as { k: Filter; label: string }[]).map(({ k, label }) => (
            <button
              key={k}
              className={`filter-tab ${filter === k ? 'active' : ''}`}
              onClick={() => setFilter(k)}
              role="tab"
              aria-selected={filter === k}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <p className="text-muted">Không có câu nào trong bộ lọc này.</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {filtered.map((q, idx) => {
            const userAnswer  = session!.answers[q.id] || '';
            const status      = getStatus(q.id);
            const isMarked    = session!.markedQuestionIds.includes(q.id);
            const globalIdx   = session!.questionOrder.indexOf(q.id);

            return (
              <ReviewItem
                key={q.id}
                q={q}
                userAnswer={userAnswer}
                status={status}
                isMarked={isMarked}
                displayNumber={globalIdx + 1}
                lang={lang}
                onZoom={setImgZoom}
              />
            );
          })}
        </div>

        <div className="flex gap-3 flex-wrap justify-center" style={{ marginTop: '2rem' }}>
          <button className="btn btn-primary" onClick={() => navigate(`/result/${id}`)}>← Kết quả</button>
          <button className="btn btn-outline" onClick={() => navigate('/')}>🏠 Trang chủ</button>
        </div>
      </div>

      {/* Image zoom */}
      {imgZoom && (
        <div className="img-overlay" onClick={() => setImgZoom(null)} role="dialog" aria-label="Phóng to hình ảnh">
          <img src={imgZoom} alt="Hình ảnh phóng to" />
        </div>
      )}
    </div>
  );
}

// ─── ReviewItem component ─────────────────────────────────────────────────
function ReviewItem({
  q, userAnswer, status, isMarked, displayNumber, lang, onZoom,
}: {
  q: Question;
  userAnswer: string;
  status: 'correct' | 'wrong' | 'unanswered';
  isMarked: boolean;
  displayNumber: number;
  lang: Language;
  onZoom: (src: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const statusStyle = {
    correct:    { border: 'var(--clr-success)',  bg: 'var(--clr-success-bg)',  label: '✅ Đúng',     icon: '✅' },
    wrong:      { border: 'var(--clr-error)',    bg: 'var(--clr-error-bg)',    label: '❌ Sai',       icon: '❌' },
    unanswered: { border: 'var(--clr-warning)',  bg: 'var(--clr-warning-bg)',  label: '⬜ Bỏ qua',   icon: '⬜' },
  }[status];

  return (
    <div style={{
      border: `2px solid ${statusStyle.border}`,
      borderRadius: 'var(--radius-lg)',
      background: '#fff',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          background: statusStyle.bg,
          padding: '.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '.75rem',
          cursor: 'pointer',
          flexWrap: 'wrap',
        }}
        onClick={() => setExpanded(v => !v)}
        role="button"
        aria-expanded={expanded}
        aria-label={`Câu ${displayNumber}: ${statusStyle.label}`}
      >
        <span style={{ fontSize: '1.1rem' }}>{statusStyle.icon}</span>
        <span className="font-bold" style={{ color: statusStyle.border }}>
          Câu {displayNumber} — {statusStyle.label}
        </span>
        {isMarked && <span className="badge badge-orange">🔖 Đánh dấu</span>}
        {q.standard && <span className="badge badge-blue">{q.standard}</span>}
        {q.bloomLevel && <span className={`badge ${bloomColor(q.bloomLevel)}`}>{q.bloomLevel}</span>}
        <span style={{ marginLeft: 'auto', color: statusStyle.border, fontWeight: 700 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '1.25rem' }}>
          {/* Images */}
          {q.images && q.images.length > 0 && (
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
              {q.images.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Hình minh họa câu ${displayNumber}`}
                  className="question-img"
                  style={{ maxHeight: 240 }}
                  onClick={() => onZoom(src)}
                />
              ))}
            </div>
          )}

          {/* Stem */}
          <div style={{ marginBottom: '1.25rem' }}>
            {(lang === 'bilingual' || lang === 'en') && (
              <div className="question-stem-en">{q.stem.en}</div>
            )}
            {(lang === 'bilingual' || lang === 'vi') && q.stem.vi && (
              <div className="question-stem-vi">{q.stem.vi}</div>
            )}
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2" style={{ marginBottom: '1.25rem' }}>
            {q.options.map(opt => {
              const isCorrect  = opt.id === q.correctOptionId;
              const isUserPick = opt.id === userAnswer;
              let cls = 'option-btn';
              if (isCorrect)                     cls += ' correct';
              else if (isUserPick && !isCorrect) cls += ' wrong';

              return (
                <div key={opt.id} className={cls} style={{ cursor: 'default' }} role="listitem">
                  <span className="option-letter">{opt.id}</span>
                  <span style={{ flex: 1 }}>
                    {(lang === 'bilingual' || lang === 'en') && <div>{opt.en}</div>}
                    {(lang === 'bilingual' || lang === 'vi') && opt.vi && opt.vi !== opt.en && (
                      <div style={{ color: 'var(--clr-neutral-500)', fontSize: '.9em', fontStyle: 'italic', marginTop: '.15rem' }}>
                        {opt.vi}
                      </div>
                    )}
                  </span>
                  {isCorrect && (
                    <span style={{ color: 'var(--clr-success)', fontWeight: 700, fontSize: '.875rem', flexShrink: 0 }}>
                      ✅ Đúng
                    </span>
                  )}
                  {isUserPick && !isCorrect && (
                    <span style={{ color: 'var(--clr-error)', fontWeight: 700, fontSize: '.875rem', flexShrink: 0 }}>
                      ❌ Đã chọn
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation */}
          {q.explanation && (q.explanation.vi || q.explanation.en) && (
            <div className="explanation-box" style={{ marginBottom: '1rem' }}>
              <div className="explanation-title">💡 Giải thích</div>
              {(lang === 'bilingual' || lang === 'vi') && q.explanation.vi && (
                <div style={{ color: 'var(--clr-accent-700)', lineHeight: 1.7 }}>
                  {q.explanation.vi}
                </div>
              )}
              {(lang === 'bilingual' || lang === 'en') && q.explanation.en && q.explanation.en !== q.explanation.vi && (
                <div style={{ color: 'var(--clr-neutral-600)', lineHeight: 1.7, marginTop: '.5rem', fontStyle: 'italic' }}>
                  {q.explanation.en}
                </div>
              )}
            </div>
          )}

          {/* Source */}
          {q.sourceText && (
            <div style={{ fontSize: '.875rem', color: 'var(--clr-neutral-500)', display: 'flex', alignItems: 'flex-start', gap: '.4rem' }}>
              <span style={{ flexShrink: 0 }}>📌</span>
              <span><strong>Nguồn:</strong> {q.sourceText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
