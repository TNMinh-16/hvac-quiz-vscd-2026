import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Language, QuizSession } from '../types';
import { getSession, retryWrong } from '../api';
import { formatDate, formatDuration, scoreColor } from '../utils';

interface Props { lang: Language }

export default function ResultPage({ lang }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<QuizSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSession(id)
      .then(s => {
        if (s.status !== 'completed') navigate(`/quiz/${id}`, { replace: true });
        else setSession(s);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRetry() {
    if (!id) return;
    setRetrying(true);
    try {
      const newSession = await retryWrong(id);
      navigate(`/quiz/${newSession.id}`);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
      setRetrying(false);
    }
  }

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;
  if (error)   return <div className="page container"><div className="error-box">{error}</div></div>;
  if (!session) return null;

  const pct = session.scorePercent;
  const color = scoreColor(pct);
  const scoPctStr = (session.scorePercent / 100 * 100).toFixed(1) + '%';

  function getGradeEmoji(pct: number) {
    if (pct >= 90) return '🏆';
    if (pct >= 80) return '🥇';
    if (pct >= 70) return '🥈';
    if (pct >= 60) return '🥉';
    return '📉';
  }

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="page-header text-center">
          <div style={{ fontSize: '3rem', marginBottom: '.5rem' }}>{getGradeEmoji(pct)}</div>
          <h1 className="page-title">Kết quả bài thi</h1>
          <p className="page-subtitle">
            {session.mode === 'sequential' ? '📚 Chế độ tuần tự' : '🔀 Chế độ xáo trộn'} ·
            {' '}{formatDate(session.completedAt || session.startedAt)}
          </p>
        </div>

        {/* Score circle + stats */}
        <div className="flex items-center justify-center gap-4 flex-wrap" style={{ marginBottom: '2rem' }}>
          {/* Score circle */}
          <div
            className="score-circle"
            style={{
              background: `conic-gradient(${color} 0% ${scoPctStr}, var(--clr-neutral-200) ${scoPctStr} 100%)`,
            } as React.CSSProperties}
            aria-label={`Điểm: ${pct}%`}
          >
            <div className="score-circle-inner">
              <div className="score-pct" style={{ color }}>{pct}%</div>
              <div className="score-label">ĐIỂM</div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex flex-col gap-3">
            <div className="stat-row">
              <div className="stat-box">
                <div className="stat-num stat-correct">{session.correctCount}</div>
                <div className="stat-desc">✅ Đúng</div>
              </div>
              <div className="stat-box">
                <div className="stat-num stat-wrong">{session.wrongCount}</div>
                <div className="stat-desc">❌ Sai</div>
              </div>
              <div className="stat-box">
                <div className="stat-num stat-unanswered">{session.unansweredCount}</div>
                <div className="stat-desc">⬜ Bỏ qua</div>
              </div>
              <div className="stat-box">
                <div className="stat-num stat-total">{session.questionOrder.length}</div>
                <div className="stat-desc">📋 Tổng</div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="stat-box flex-1">
                <div className="stat-num" style={{ fontSize: '1.25rem', color: 'var(--clr-primary-600)' }}>
                  ⏱ {formatDuration(session.durationSeconds)}
                </div>
                <div className="stat-desc">Thời gian</div>
              </div>
              <div className="stat-box flex-1">
                <div className="stat-num" style={{ fontSize: '1.1rem', color: 'var(--clr-neutral-600)' }}>
                  {session.mode === 'sequential' ? '📚 Tuần tự' : '🔀 Xáo trộn'}
                </div>
                <div className="stat-desc">Chế độ</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bar: correct / wrong / unanswered */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>📊 Phân bố kết quả</h3>
          <div style={{ height: 28, display: 'flex', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {session.correctCount > 0 && (
              <div style={{
                width: `${(session.correctCount / session.questionOrder.length) * 100}%`,
                background: 'var(--clr-success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '.8rem', fontWeight: 700, transition: 'width .5s ease',
              }}>
                {session.correctCount > 3 ? `${session.correctCount} đúng` : ''}
              </div>
            )}
            {session.wrongCount > 0 && (
              <div style={{
                width: `${(session.wrongCount / session.questionOrder.length) * 100}%`,
                background: 'var(--clr-error)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '.8rem', fontWeight: 700,
              }}>
                {session.wrongCount > 3 ? `${session.wrongCount} sai` : ''}
              </div>
            )}
            {session.unansweredCount > 0 && (
              <div style={{
                width: `${(session.unansweredCount / session.questionOrder.length) * 100}%`,
                background: 'var(--clr-neutral-300)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--clr-neutral-600)', fontSize: '.8rem', fontWeight: 700,
              }}>
                {session.unansweredCount > 3 ? `${session.unansweredCount} bỏ` : ''}
              </div>
            )}
          </div>
          <div className="flex gap-4 mt-3 flex-wrap text-sm">
            <span className="flex items-center gap-1">
              <span style={{ width: 12, height: 12, background: 'var(--clr-success)', borderRadius: 2, display: 'inline-block' }} />
              Đúng: {session.correctCount} ({((session.correctCount / session.questionOrder.length) * 100).toFixed(1)}%)
            </span>
            <span className="flex items-center gap-1">
              <span style={{ width: 12, height: 12, background: 'var(--clr-error)', borderRadius: 2, display: 'inline-block' }} />
              Sai: {session.wrongCount} ({((session.wrongCount / session.questionOrder.length) * 100).toFixed(1)}%)
            </span>
            <span className="flex items-center gap-1">
              <span style={{ width: 12, height: 12, background: 'var(--clr-neutral-300)', borderRadius: 2, display: 'inline-block' }} />
              Bỏ qua: {session.unansweredCount}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap justify-center" style={{ marginBottom: '2rem' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate(`/review/${id}`)}
            aria-label="Xem đáp án và lời giải"
          >
            🔍 Xem đáp án & lời giải
          </button>

          {session.wrongCount > 0 && (
            <button
              className="btn btn-accent btn-lg"
              onClick={handleRetry}
              disabled={retrying}
              aria-label={`Luyện lại ${session.wrongCount} câu sai`}
            >
              {retrying ? '⏳...' : `🔁 Luyện lại ${session.wrongCount} câu sai`}
            </button>
          )}

          <button
            className="btn btn-outline btn-lg"
            onClick={() => navigate('/')}
            aria-label="Về trang chủ"
          >
            🏠 Về trang chủ
          </button>
        </div>

      </div>
    </div>
  );
}
