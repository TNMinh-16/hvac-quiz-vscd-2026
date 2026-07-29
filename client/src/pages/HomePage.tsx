import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Language } from '../types';
import type { Metadata, QuizSession, Section } from '../types';
import { getMetadata, getSections, getRecentSessions, getInProgressSessions, createSession } from '../api';
import { formatDate, formatDuration, scoreColor } from '../utils';

interface Props { lang: Language }

export default function HomePage({ lang }: Props) {
  const navigate = useNavigate();
  const [meta, setMeta]         = useState<Metadata | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [recent, setRecent]     = useState<QuizSession[]>([]);
  const [inProg, setInProg]     = useState<QuizSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [m, s, r, ip] = await Promise.all([
          getMetadata(), getSections(), getRecentSessions(5), getInProgressSessions(),
        ]);
        setMeta(m); setSections(s); setRecent(r); setInProg(ip);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function startSequential() {
    navigate('/sections');
  }

  async function startShuffled() {
    navigate('/shuffle');
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <span>Đang tải dữ liệu...</span>
    </div>
  );

  if (error) return (
    <div className="page container">
      <div className="error-box">
        <strong>Lỗi kết nối:</strong> {error}
        <br /><br />
        <small>Đảm bảo server đang chạy: <code>npm start</code> và đã import dữ liệu: <code>python scripts/import_docx.py</code></small>
      </div>
    </div>
  );

  const bloomSections = sections.filter(s => s.level === 1 && s.bloomLevel);

  return (
    <div className="page">
      <div className="container-wide">

        {/* Hero Banner */}
        <div className="hero-banner">
          <div className="hero-title">🌬️ HVAC Quiz</div>
          <div style={{ fontSize: '.9rem', color: 'rgba(255,255,255,.6)', marginBottom: '.25rem', fontWeight: 600 }}>
            ASHRAE VSCD 2026
          </div>
          <div className="hero-sub">
            Luyện tập trắc nghiệm {meta?.questionCount} câu hỏi song ngữ Anh–Việt, bao gồm các tiêu chuẩn ASHRAE 52.2, 55, 62.1 và 90.1.
          </div>
          <div className="hero-chips">
            {meta?.standards.map(std => (
              <span key={std} className="hero-chip">{std}</span>
            ))}
            <span className="hero-chip">{meta?.questionCount} câu hỏi</span>
            <span className="hero-chip">6 cấp Bloom</span>
          </div>
        </div>

        {/* In-progress sessions */}
        {inProg.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div className="section-label">📌 Bài đang làm dở</div>
            <div className="flex flex-col gap-3">
              {inProg.slice(0, 3).map(s => (
                <div key={s.id} className="history-item card-hover" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/quiz/${s.id}`)} role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/quiz/${s.id}`)}>
                  <div className="history-score" style={{ fontSize: '1.5rem' }}>{s.mode === 'sequential' ? '📚' : '🔀'}</div>
                  <div className="history-divider" style={{ width: 1, height: 48, margin: '0 .5rem', background: 'var(--clr-neutral-200)' }} />
                  <div className="flex-1">
                    <div className="font-semibold" style={{ color: 'var(--clr-primary-700)' }}>
                      {s.mode === 'sequential' ? 'Luyện tuần tự' : 'Luyện xáo trộn'}
                    </div>
                    <div className="text-sm text-muted">
                      {Object.keys(s.answers).length}/{s.questionOrder.length} câu · Bắt đầu {formatDate(s.startedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 history-actions">
                    <span className="badge badge-orange">Đang làm</span>
                    <button className="btn btn-primary btn-sm">Tiếp tục</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mode selection */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
          <button className="mode-card" onClick={startSequential} aria-label="Luyện theo từng phần">
            <div className="mode-card-icon">📚</div>
            <div>
              <div className="mode-card-title">Luyện theo phần</div>
              <div className="mode-card-desc">
                Làm câu hỏi theo đúng thứ tự trong tài liệu. Lý tưởng để học có hệ thống từng cấp Bloom và tiêu chuẩn ASHRAE.
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {bloomSections.slice(0, 6).map(s => (
                <span key={s.id} style={{
                  background: 'rgba(255,255,255,.15)',
                  padding: '.2rem .55rem',
                  borderRadius: '99px',
                  fontSize: '.78rem',
                  fontWeight: 600,
                }}>
                  {s.titleEn.replace('BLOOM ', 'B').split('·')[0].trim()}
                </span>
              ))}
            </div>
          </button>

          <button className="mode-card mode-card-accent" onClick={startShuffled} aria-label="Luyện xáo trộn ngẫu nhiên">
            <div className="mode-card-icon">🔀</div>
            <div>
              <div className="mode-card-title">Luyện xáo trộn</div>
              <div className="mode-card-desc">
                Xáo trộn câu hỏi ngẫu nhiên. Lọc theo phần, tiêu chuẩn hoặc cấp Bloom. Chọn số lượng 10, 20, 50 hoặc tùy ý.
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['10 câu', '20 câu', '50 câu', '100 câu', 'Toàn bộ'].map(t => (
                <span key={t} style={{
                  background: 'rgba(255,255,255,.15)',
                  padding: '.2rem .55rem',
                  borderRadius: '99px',
                  fontSize: '.78rem',
                  fontWeight: 600,
                }}>{t}</span>
              ))}
            </div>
          </button>

          <button className="mode-card" style={{ background: 'linear-gradient(135deg, var(--clr-primary-800) 0%, #334155 100%)', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => navigate('/guide')} aria-label="Hướng dẫn sử dụng website">
            <div className="mode-card-icon">📖</div>
            <div>
              <div className="mode-card-title">Hướng Dẫn Sử Dụng</div>
              <div className="mode-card-desc">
                Cẩm nang khai thác chi tiết: cách chọn đề thi, sử dụng phím tắt bàn phím A-B-C-D, xem thống kê Bloom và luyện câu sai.
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Phím tắt', 'Lưu tự động', 'Bảo mật 403', 'Phục thù câu sai'].map(t => (
                <span key={t} style={{
                  background: 'rgba(255,255,255,.15)',
                  padding: '.2rem .55rem',
                  borderRadius: '99px',
                  fontSize: '.78rem',
                  fontWeight: 600,
                }}>{t}</span>
              ))}
            </div>
          </button>
        </div>

        {/* Stats row */}
        <div className="stat-row" style={{ marginBottom: '2.5rem' }}>
          <div className="stat-box">
            <div className="stat-num stat-total">{meta?.questionCount}</div>
            <div className="stat-desc">Tổng câu hỏi</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: 'var(--clr-primary-600)' }}>{sections.filter(s=>s.level===1).length}</div>
            <div className="stat-desc">Cấp Bloom</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: 'var(--clr-accent-600)' }}>{meta?.standards.length}</div>
            <div className="stat-desc">Tiêu chuẩn ASHRAE</div>
          </div>
          <div className="stat-box">
            <div className="stat-num stat-total">{recent.length > 0 ? recent[0].scorePercent + '%' : '—'}</div>
            <div className="stat-desc">Điểm gần nhất</div>
          </div>
        </div>

        {/* Recent sessions */}
        {recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: '.75rem' }}>
              <div className="section-label" style={{ marginBottom: 0 }}>🕐 5 lần luyện gần nhất</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
                Xem tất cả →
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {recent.map(s => (
                <RecentItem key={s.id} session={s} onOpen={() => navigate(`/result/${s.id}`)} />
              ))}
            </div>
          </div>
        )}

        {recent.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <p className="text-muted">Chưa có lần luyện nào. Hãy bắt đầu!</p>
          </div>
        )}

      </div>
    </div>
  );
}

function RecentItem({ session, onOpen }: { session: QuizSession; onOpen: () => void }) {
  const pct = session.scorePercent;
  return (
    <div className="history-item card-hover" onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      style={{ cursor: 'pointer' }}
    >
      <div className="history-score">
        <div className="history-score-num" style={{ color: scoreColor(pct) }}>{pct}%</div>
        <div className="history-score-pct">điểm</div>
      </div>
      <div className="history-divider" style={{ width: 1, height: 48, margin: '0 .5rem', background: 'var(--clr-neutral-200)' }} />
      <div className="flex-1">
        <div className="font-semibold" style={{ fontSize: '.9375rem' }}>
          {session.mode === 'sequential' ? '📚 Tuần tự' : '🔀 Xáo trộn'}
        </div>
        <div className="text-sm text-muted">
          {session.correctCount}/{session.questionOrder.length} đúng · {formatDuration(session.durationSeconds)} · {formatDate(session.completedAt || session.startedAt)}
        </div>
      </div>
      <div className="flex items-center gap-2 history-actions">
        <span className="badge badge-green">Hoàn thành</span>
        <button className="btn btn-outline btn-sm">Xem lại</button>
      </div>
    </div>
  );
}
