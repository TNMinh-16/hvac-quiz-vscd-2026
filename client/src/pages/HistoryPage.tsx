import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Language, QuizSession } from '../types';
import { getAllSessions } from '../api';
import { formatDate, formatDuration, scoreColor } from '../utils';

interface Props { lang: Language }

export default function HistoryPage({ lang }: Props) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState<'all' | 'completed' | 'in_progress'>('all');

  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    getAllSessions()
      .then(setSessions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;
  if (error)   return <div className="page container"><div className="error-box">{error}</div></div>;

  const filtered = sessions.filter(s => {
    if (filter === 'completed')    return s.status === 'completed';
    if (filter === 'in_progress')  return s.status === 'in_progress';
    return true;
  });

  const visibleSessions = filtered.slice(0, visibleCount);

  return (
    <div className="page">
      <div className="container">

        <div className="page-header">
          <h1 className="page-title">📋 Lịch sử làm bài</h1>
          <p className="page-subtitle">Toàn bộ các lần luyện tập, mới nhất trước</p>
        </div>

        {/* Filter */}
        <div className="filter-tabs" style={{ marginBottom: '1.5rem' }} role="tablist">
          {([
            { k: 'all',         label: `Tất cả (${sessions.length})` },
            { k: 'completed',   label: `✅ Hoàn thành (${sessions.filter(s=>s.status==='completed').length})` },
            { k: 'in_progress', label: `⏳ Đang làm (${sessions.filter(s=>s.status==='in_progress').length})` },
          ] as { k: typeof filter; label: string }[]).map(({ k, label }) => (
            <button
              key={k}
              className={`filter-tab ${filter === k ? 'active' : ''}`}
              onClick={() => { setFilter(k); setVisibleCount(20); }}
              role="tab"
              aria-selected={filter === k}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="text-muted">Chưa có lần làm bài nào.</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>
              Bắt đầu luyện tập
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {visibleSessions.map((s, idx) => (
            <HistoryRow
              key={s.id}
              session={s}
              index={sessions.indexOf(s) + 1}
              onOpen={() => s.status === 'completed'
                ? navigate(`/result/${s.id}`)
                : navigate(`/quiz/${s.id}`)
              }
            />
          ))}
        </div>

        {/* Nút Tải thêm để tối ưu hiệu suất khi lịch sử rất lớn */}
        {filtered.length > visibleCount && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem', marginBottom: '2rem' }}>
            <button
              className="btn btn-outline"
              style={{ padding: '0.75rem 2rem', fontWeight: 600 }}
              onClick={() => setVisibleCount(prev => prev + 20)}
            >
              ▼ Tải thêm 20 lượt bài làm (Còn {filtered.length - visibleCount} lượt)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function HistoryRow({ session: s, index, onOpen }: {
  session: QuizSession;
  index: number;
  onOpen: () => void;
}) {
  const pct   = s.scorePercent;
  const color = scoreColor(pct);
  const isCompleted = s.status === 'completed';

  return (
    <div
      className="history-item card-hover"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      style={{ cursor: 'pointer' }}
      aria-label={`Lần ${index}: ${isCompleted ? `${pct}%` : 'Đang làm'}, ${s.mode === 'sequential' ? 'tuần tự' : 'xáo trộn'}`}
    >
      {/* Score */}
      <div className="history-score">
        {isCompleted ? (
          <>
            <div className="history-score-num" style={{ color }}>{pct}%</div>
            <div className="history-score-pct">điểm</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '1.5rem' }}>⏳</div>
            <div className="history-score-pct">đang làm</div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="history-divider" style={{ width: 1, height: 48, background: 'var(--clr-neutral-200)', margin: '0 .25rem', flexShrink: 0 }} />

      {/* Info */}
      <div className="flex-1">
        <div className="font-semibold" style={{ fontSize: '.9375rem' }}>
          {s.mode === 'sequential' ? '📚 Tuần tự' : '🔀 Xáo trộn'}
          {' '}
          <span className="text-muted text-sm font-medium">
            · {s.questionOrder.length} câu
          </span>
        </div>
        <div className="text-sm text-muted">
          {isCompleted
            ? `${s.correctCount} đúng · ${s.wrongCount} sai · ${formatDuration(s.durationSeconds)} · ${formatDate(s.completedAt || s.startedAt)}`
            : `${Object.keys(s.answers).length}/${s.questionOrder.length} đã trả lời · Bắt đầu ${formatDate(s.startedAt)}`
          }
        </div>
      </div>

      {/* Status & Action */}
      <div className="flex items-center gap-2 history-actions">
        {isCompleted
          ? <span className="badge badge-green">Hoàn thành</span>
          : <span className="badge badge-orange">Đang làm</span>
        }
        <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); onOpen(); }}>
          {isCompleted ? 'Xem lại' : 'Tiếp tục'}
        </button>
      </div>
    </div>
  );
}
