import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Language, Section } from '../types';
import { getSections, createSession } from '../api';

interface Props { lang: Language }

export default function SectionsPage({ lang }: Props) {
  const navigate = useNavigate();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    getSections()
      .then(setSections)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function startSection(sec: Section) {
    setStarting(sec.id);
    try {
      const session = await createSession({
        mode: 'sequential',
        sectionIds: [sec.id],
      });
      navigate(`/quiz/${session.id}`);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
      setStarting(null);
    }
  }

  async function startAll() {
    setStarting('all');
    try {
      const session = await createSession({ mode: 'sequential' });
      navigate(`/quiz/${session.id}`);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
      setStarting(null);
    }
  }

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /><span>Đang tải...</span></div>;
  if (error)   return <div className="page container"><div className="error-box">{error}</div></div>;

  // Group by Bloom level (Heading 1) → standards (Heading 2)
  const bloom1 = sections.filter(s => s.level === 1);
  const bloom2Map: Record<string, Section[]> = {};
  for (const s of sections.filter(s => s.level === 2)) {
    const parent = s.parentId || 'none';
    if (!bloom2Map[parent]) bloom2Map[parent] = [];
    bloom2Map[parent].push(s);
  }

  const BLOOM_COLORS: Record<string, string> = {
    'Remember':   '#2563a8',
    'Understand': '#059669',
    'Apply':      '#d97706',
    'Analyze':    '#7c3aed',
    'Evaluate':   '#dc2626',
    'Create':     '#db2777',
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">📚 Luyện theo phần</h1>
          <p className="page-subtitle">
            Chọn một phần để bắt đầu luyện tập theo đúng thứ tự trong tài liệu
          </p>
        </div>

        <div className="flex gap-3" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={startAll}
            disabled={starting === 'all'}
            aria-label="Luyện toàn bộ 1000 câu theo thứ tự"
          >
            {starting === 'all' ? '⏳ Đang tạo...' : '▶ Luyện toàn bộ 1000 câu'}
          </button>
        </div>

        {bloom1.map(b1 => {
          const bloomName = b1.bloomLevel || b1.titleEn.split('·')[0].trim();
          const color = BLOOM_COLORS[bloomName] || 'var(--clr-primary-500)';
          const subsections = bloom2Map[b1.id] || [];
          const totalQs = subsections.reduce((sum, sub) => sum + (sub.questionIds?.length || 0), 0);

          return (
            <div key={b1.id} className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
              {/* Bloom heading */}
              <div className="flex items-center gap-3" style={{ marginBottom: '1rem' }}>
                <div style={{
                  width: 42, height: 42,
                  borderRadius: 'var(--radius-lg)',
                  background: color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: '.9rem',
                  flexShrink: 0,
                }}>
                  B{(bloom1.indexOf(b1) + 1)}
                </div>
                <div>
                  <div className="font-bold" style={{ color, fontSize: '1.0625rem' }}>
                    {b1.titleEn}
                  </div>
                  <div className="text-sm text-muted">
                    {totalQs} câu hỏi
                  </div>
                </div>
              </div>

              {/* Standard subsections */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.75rem' }}>
                {subsections.map(sub => (
                  <button
                    key={sub.id}
                    className="card card-hover"
                    style={{
                      padding: '1rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      border: '2px solid var(--clr-neutral-200)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '.5rem',
                      background: starting === sub.id ? 'var(--clr-primary-50)' : '#fff',
                      opacity: starting && starting !== sub.id ? .7 : 1,
                    }}
                    onClick={() => startSection(sub)}
                    disabled={!!starting}
                    aria-label={`Luyện phần ${sub.titleEn}, ${sub.questionIds.length} câu`}
                  >
                    <div className="font-semibold" style={{ fontSize: '.9375rem', color: 'var(--clr-primary-700)' }}>
                      {sub.titleEn.replace(/ASHRAE\s+/i, '')}
                    </div>
                    {sub.standard && (
                      <div className="text-sm" style={{ color: 'var(--clr-neutral-500)' }}>
                        {sub.standard}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="badge badge-blue">{sub.questionIds.length} câu</span>
                      {starting === sub.id
                        ? <span className="text-sm text-muted">Đang tạo...</span>
                        : <span style={{ color, fontWeight: 700, fontSize: '.875rem' }}>Luyện →</span>
                      }
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
