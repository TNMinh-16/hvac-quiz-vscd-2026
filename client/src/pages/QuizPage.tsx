import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Language, QuizSession, Question } from '../types';
import { getSession, getQuestions, saveAnswers, saveMarks, submitSession } from '../api';
import { useTimer, formatDuration, bloomColor } from '../utils';

interface Props { lang: Language }

export default function QuizPage({ lang }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession]     = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [currentIdx, setCurrentIdx]       = useState(0);
  const [answers, setAnswers]             = useState<Record<string, string>>({});
  const [marked, setMarked]               = useState<string[]>([]);
  const [showNavPanel, setShowNavPanel]   = useState(false);
  const [imgZoom, setImgZoom]             = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting]       = useState(false);

  // Timer: elapsed from session start
  const startSecondsRef = useRef(0);
  const elapsed = useTimer(0, !!session && session.status === 'in_progress');
  const elapsedRef = useRef(elapsed); elapsedRef.current = elapsed;
  const answersRef = useRef(answers); answersRef.current = answers;
  const markedRef  = useRef(marked);  markedRef.current = marked;

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savingPromiseRef = useRef<Promise<any> | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Robust Sequential & Stable Autosave Logic
  const triggerSave = useCallback(async () => {
    if (!id || !session || session.status === 'completed') return;
    if (savingPromiseRef.current) {
      try { await savingPromiseRef.current; } catch { /* ignore */ }
    }
    setSaveStatus('saving');
    const promise = (async () => {
      try {
        const totalDuration = startSecondsRef.current + elapsedRef.current;
        await Promise.all([
          saveAnswers(id, answersRef.current, totalDuration),
          saveMarks(id, markedRef.current),
        ]);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('error');
      } finally {
        savingPromiseRef.current = null;
      }
    })();
    savingPromiseRef.current = promise;
    return promise;
  }, [id, session?.status]);

  const scheduleDebouncedSave = useCallback(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      triggerSave();
    }, 1500);
  }, [triggerSave]);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const s = await getSession(id!);
        if (s.status === 'completed') {
          navigate(`/result/${id}`, { replace: true });
          return;
        }
        setSession(s);
        setAnswers(s.answers);
        answersRef.current = s.answers;
        setMarked(s.markedQuestionIds);
        markedRef.current = s.markedQuestionIds;
        startSecondsRef.current = s.durationSeconds;

        const qs = await getQuestions(s.questionOrder);
        // Reorder to match questionOrder
        const qMap = Object.fromEntries(qs.map(q => [q.id, q]));
        setQuestions(s.questionOrder.map(qid => qMap[qid]).filter(Boolean));

        // Start from first unanswered
        const firstUnanswered = s.questionOrder.findIndex(qid => !s.answers[qid]);
        setCurrentIdx(firstUnanswered >= 0 ? firstUnanswered : 0);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Stable Auto-save interval (every 30s) that never resets on elapsed/answer changes
  useEffect(() => {
    const timer = setInterval(() => {
      triggerSave();
    }, 30000);
    return () => clearInterval(timer);
  }, [triggerSave]);

  // Save when exiting page or unmounting
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (['a','b','c','d'].includes(e.key.toLowerCase())) {
        const letter = e.key.toUpperCase();
        selectAnswer(letter);
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev();
      if (e.key === 'm' || e.key === 'M') toggleMark();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIdx, answers, marked]);

  const currentQ = questions[currentIdx];

  function selectAnswer(letter: string) {
    if (!currentQ) return;
    setAnswers(prev => {
      const next = { ...prev, [currentQ.id]: letter };
      answersRef.current = next;
      scheduleDebouncedSave();
      return next;
    });
  }

  function goNext() { setCurrentIdx(i => Math.min(i + 1, questions.length - 1)); }
  function goPrev() { setCurrentIdx(i => Math.max(i - 1, 0)); }

  function toggleMark() {
    if (!currentQ) return;
    setMarked(prev => {
      const next = prev.includes(currentQ.id)
        ? prev.filter(x => x !== currentQ.id)
        : [...prev, currentQ.id];
      markedRef.current = next;
      scheduleDebouncedSave();
      return next;
    });
  }

  function handleSubmitClick() {
    setShowSubmitModal(true);
  }

  async function handleConfirmSubmit() {
    if (!id) return;
    setSubmitting(true);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (savingPromiseRef.current) {
      try { await savingPromiseRef.current; } catch { /* ignore */ }
    }
    try {
      const finalDuration = startSecondsRef.current + elapsedRef.current;
      await saveAnswers(id, answersRef.current, finalDuration);
      await saveMarks(id, markedRef.current);
      await submitSession(id, finalDuration);
      navigate(`/result/${id}`);
    } catch (e: any) {
      alert('Lỗi khi nộp bài: ' + e.message);
      setSubmitting(false);
    }
    setShowSubmitModal(false);
  }

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /><span>Đang tải bài thi...</span></div>;
  if (error)   return <div className="page container"><div className="error-box">{error}</div></div>;
  if (!session || questions.length === 0) return <div className="page container"><div className="empty-state"><p>Không tìm thấy bài thi.</p></div></div>;

  const answeredCount  = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const progress = (answeredCount / questions.length) * 100;
  const isMarked = currentQ ? marked.includes(currentQ.id) : false;

  return (
    <>
      {/* Top bar */}
      <div className="quiz-topbar">
        <div className="flex items-center gap-3 flex-1 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Thoát</button>
          <div className="flex-1" style={{ minWidth: 160 }}>
            <div className="progress-bar-outer">
              <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
            </div>
            <div className="text-xs text-muted mt-1">
              {answeredCount}/{questions.length} câu đã trả lời
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <span className="text-xs text-muted" style={{ fontWeight: 600 }}>⏳ Đang lưu...</span>}
          {saveStatus === 'saved'  && <span className="text-xs" style={{ color: 'var(--clr-accent-600)', fontWeight: 600 }}>✓ Đã lưu</span>}
          {saveStatus === 'error'  && <span className="text-xs" style={{ color: 'var(--clr-danger-600)', fontWeight: 600 }}>⚠️ Lỗi lưu!</span>}
          <div className="timer" aria-label="Thời gian làm bài">
            ⏱ {formatDuration(startSecondsRef.current + elapsed)}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setShowNavPanel(v => !v); }}
            aria-label="Hiện/ẩn bảng điều hướng câu"
          >
            📋 {questions.length} câu
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmitClick}
            aria-label="Nộp bài thi"
          >
            Nộp bài
          </button>
        </div>
      </div>

      <div className="quiz-layout">
        {/* Main question area */}
        <div>
          {currentQ && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              {/* Question header */}
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '1rem' }}>
                <span className="badge badge-blue" style={{ fontSize: '.9rem', padding: '.3rem .8rem', fontWeight: 800 }}>
                  Câu {currentIdx + 1}/{questions.length}
                </span>
                {currentQ.standard && (
                  <span className="badge badge-green">{currentQ.standard}</span>
                )}
                {currentQ.bloomLevel && (
                  <span className={`badge ${bloomColor(currentQ.bloomLevel)}`}>
                    {currentQ.bloomLevel}
                  </span>
                )}
                {currentQ.topic?.en && (
                  <span className="badge badge-gray">{currentQ.topic.en}</span>
                )}
              </div>

              {/* Images */}
              {currentQ.images && currentQ.images.length > 0 && (
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                  {currentQ.images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Hình minh họa câu ${currentIdx + 1}`}
                      className="question-img"
                      style={{ maxHeight: 280 }}
                      onClick={() => setImgZoom(src)}
                    />
                  ))}
                </div>
              )}

              {/* Stem */}
              <div style={{ marginBottom: '1.5rem' }}>
                {(lang === 'bilingual' || lang === 'en') && (
                  <div className="question-stem-en">{currentQ.stem.en}</div>
                )}
                {(lang === 'bilingual' || lang === 'vi') && currentQ.stem.vi && (
                  <div className="question-stem-vi">{currentQ.stem.vi}</div>
                )}
              </div>

              {/* Options */}
              <div className="flex flex-col gap-3" role="radiogroup" aria-label="Các lựa chọn đáp án">
                {currentQ.options.map(opt => {
                  const isSelected = answers[currentQ.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      className={`option-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => selectAnswer(opt.id)}
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Lựa chọn ${opt.id}: ${opt.en}`}
                    >
                      <span className="option-letter">{opt.id}</span>
                      <span>
                        {(lang === 'bilingual' || lang === 'en') && (
                          <div>{opt.en}</div>
                        )}
                        {(lang === 'bilingual' || lang === 'vi') && opt.vi && opt.vi !== opt.en && (
                          <div style={{ color: 'var(--clr-neutral-500)', fontSize: '.9em', fontStyle: 'italic', marginTop: '.2rem' }}>
                            {opt.vi}
                          </div>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '1.5rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={goPrev} disabled={currentIdx === 0}
                  aria-label="Câu trước">← Trước</button>
                <button className="btn btn-ghost btn-sm" onClick={goNext} disabled={currentIdx === questions.length - 1}
                  aria-label="Câu sau">Tiếp →</button>
                <button
                  className={`mark-btn ${isMarked ? 'marked' : ''}`}
                  onClick={() => toggleMark()}
                  aria-label={isMarked ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}
                  aria-pressed={isMarked}
                >
                  {isMarked ? '🔖 Đã đánh dấu' : '🔖 Đánh dấu'}
                </button>
                <div className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                  Phím tắt: <span className="kbd">A</span><span className="kbd">B</span><span className="kbd">C</span><span className="kbd">D</span> · <span className="kbd">←</span><span className="kbd">→</span> · <span className="kbd">M</span> đánh dấu
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: nav panel */}
        {showNavPanel && (
          <div className="quiz-sidebar">
            <div className="font-semibold" style={{ marginBottom: '.75rem' }}>
              📋 Điều hướng câu hỏi
            </div>

            {/* Legend */}
            <div className="flex gap-2 flex-wrap text-xs" style={{ marginBottom: '.75rem' }}>
              <span className="flex items-center gap-1">
                <span style={{ width: 14, height: 14, background: 'var(--clr-neutral-200)', borderRadius: 3, display: 'inline-block' }} />
                Chưa trả lời
              </span>
              <span className="flex items-center gap-1">
                <span style={{ width: 14, height: 14, background: 'var(--clr-primary-500)', borderRadius: 3, display: 'inline-block' }} />
                Đã trả lời
              </span>
              <span className="flex items-center gap-1">
                <span style={{ width: 14, height: 14, background: 'var(--clr-warning)', borderRadius: 3, display: 'inline-block' }} />
                Đánh dấu
              </span>
            </div>

            <div className="nav-grid">
              {questions.map((q, idx) => {
                const isAns = !!answers[q.id];
                const isMark = marked.includes(q.id);
                const isCur  = idx === currentIdx;
                let cls = 'nav-cell ';
                cls += isMark ? 'nav-cell-marked' : isAns ? 'nav-cell-answered' : 'nav-cell-unanswered';
                if (isCur) cls += ' nav-cell-current';
                return (
                  <button
                    key={q.id}
                    className={cls}
                    onClick={() => setCurrentIdx(idx)}
                    aria-label={`Câu ${idx + 1}${isAns ? ' (đã trả lời)' : ''}${isMark ? ' (đã đánh dấu)' : ''}`}
                    title={`Câu ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="divider" />
            <div className="text-sm text-muted">
              <div>✅ Đã trả lời: {answeredCount}</div>
              <div>⬜ Chưa trả lời: {unansweredCount}</div>
              <div>🔖 Đã đánh dấu: {marked.length}</div>
            </div>
          </div>
        )}
      </div>

      {/* Submit modal */}
      {showSubmitModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal">
            <div className="modal-title" id="modal-title">📤 Xác nhận nộp bài</div>
            <div className="modal-body">
              {unansweredCount > 0 ? (
                <>
                  <p>Bạn còn <strong style={{ color: 'var(--clr-warning)' }}>{unansweredCount} câu chưa trả lời</strong>.</p>
                  <p style={{ marginTop: '.5rem' }}>Các câu chưa trả lời sẽ được tính là <strong>sai</strong>. Bạn có chắc muốn nộp bài?</p>
                </>
              ) : (
                <p>Bạn đã trả lời tất cả {questions.length} câu. Xác nhận nộp bài?</p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowSubmitModal(false)}>
                Quay lại làm bài
              </button>
              <button className="btn btn-primary" onClick={handleConfirmSubmit} disabled={submitting}
                aria-label="Xác nhận nộp bài">
                {submitting ? '⏳ Đang nộp...' : '✅ Xác nhận nộp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image zoom overlay */}
      {imgZoom && (
        <div className="img-overlay" onClick={() => setImgZoom(null)} role="dialog" aria-label="Phóng to hình ảnh">
          <img src={imgZoom} alt="Hình ảnh phóng to" />
        </div>
      )}
    </>
  );
}
