import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Language, Section, Metadata } from '../types';
import { getSections, getMetadata, createSession } from '../api';

interface Props { lang: Language }

const COUNT_PRESETS = [10, 20, 50, 100];

export default function ShuffleSetupPage({ lang }: Props) {
  const navigate = useNavigate();
  const [sections, setSections] = useState<Section[]>([]);
  const [meta, setMeta]         = useState<Metadata | null>(null);
  const [loading, setLoading]   = useState(true);
  const [starting, setStarting] = useState(false);

  // Filters
  const [selSections, setSelSections]  = useState<string[]>([]);
  const [selStandard, setSelStandard]  = useState('');
  const [selBloom, setSelBloom]        = useState('');
  const [countMode, setCountMode]      = useState<number | 'all' | 'custom'>('all');
  const [customCount, setCustomCount]  = useState(30);

  useEffect(() => {
    Promise.all([getSections(), getMetadata()])
      .then(([s, m]) => { setSections(s); setMeta(m); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Estimate filtered count
  const subsections = sections.filter(s => s.level === 2);
  let filteredCount = sections
    .flatMap(s => s.questionIds)
    .filter((_, __, all) => true).length;

  // Rough estimate (full estimate needs backend)
  // Just show total for now; backend will filter precisely
  const bloom1 = sections.filter(s => s.level === 1);
  const bloomNames = bloom1.map(s => s.bloomLevel || '').filter(Boolean);

  const resolvedCount = (): number => {
    if (countMode === 'all') return filteredCount;
    if (countMode === 'custom') return Math.max(1, customCount);
    return Math.min(countMode, filteredCount);
  };

  async function handleStart() {
    setStarting(true);
    try {
      const count = countMode === 'all' ? undefined : resolvedCount();
      const session = await createSession({
        mode: 'shuffled',
        filters: {
          sectionIds: selSections.length > 0 ? selSections : undefined,
          standard: selStandard || undefined,
          bloomLevel: selBloom || undefined,
          count,
        },
      });
      navigate(`/quiz/${session.id}`);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
      setStarting(false);
    }
  }

  function toggleSection(id: string) {
    setSelSections(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /><span>Đang tải...</span></div>;

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">🔀 Cấu hình luyện xáo trộn</h1>
          <p className="page-subtitle">Lọc và chọn số lượng câu trước khi bắt đầu</p>
        </div>

        <div className="flex" style={{ gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Left: filters */}
          <div className="flex-1" style={{ minWidth: 280 }}>

            {/* Standard filter */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '.75rem' }}>📋 Tiêu chuẩn ASHRAE</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  className={`filter-tab ${!selStandard ? 'active' : ''}`}
                  onClick={() => setSelStandard('')}
                >Tất cả</button>
                {meta?.standards.map(std => (
                  <button
                    key={std}
                    className={`filter-tab ${selStandard === std ? 'active' : ''}`}
                    onClick={() => setSelStandard(std === selStandard ? '' : std)}
                  >
                    {std.replace('ASHRAE ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Bloom filter */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '.75rem' }}>🧠 Cấp độ Bloom</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  className={`filter-tab ${!selBloom ? 'active' : ''}`}
                  onClick={() => setSelBloom('')}
                >Tất cả</button>
                {meta?.bloomLevels.map(bl => (
                  <button
                    key={bl}
                    className={`filter-tab ${selBloom === bl ? 'active' : ''}`}
                    onClick={() => setSelBloom(bl === selBloom ? '' : bl)}
                  >
                    {bl}
                  </button>
                ))}
              </div>
            </div>

            {/* Section filter */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '.75rem' }}>📂 Phần kiến thức <span className="text-muted text-sm">(tuỳ chọn)</span></h3>
              <div className="flex flex-col gap-2">
                {subsections.map(sub => (
                  <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selSections.includes(sub.id)}
                      onChange={() => toggleSection(sub.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '.9rem' }}>
                      {sub.titleEn}
                      <span className="badge badge-gray" style={{ marginLeft: '.5rem' }}>
                        {sub.questionIds.length}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right: count + start */}
          <div style={{ width: 280 }}>
            <div className="card" style={{ marginBottom: '1rem', position: 'sticky', top: 140 }}>
              <h3 style={{ marginBottom: '1rem' }}>🎯 Số câu hỏi</h3>

              <div className="flex flex-col gap-2" style={{ marginBottom: '1rem' }}>
                {COUNT_PRESETS.map(n => (
                  <button
                    key={n}
                    className={`btn ${countMode === n ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCountMode(n)}
                  >
                    {n} câu
                  </button>
                ))}
                <button
                  className={`btn ${countMode === 'all' ? 'btn-accent' : 'btn-outline'}`}
                  onClick={() => setCountMode('all')}
                >
                  Toàn bộ
                </button>
                <button
                  className={`btn ${countMode === 'custom' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCountMode('custom')}
                >
                  Tuỳ chọn
                </button>
              </div>

              {countMode === 'custom' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="custom-count">Số câu (1–304)</label>
                  <input
                    id="custom-count"
                    type="number"
                    min={1}
                    max={304}
                    value={customCount}
                    onChange={e => setCustomCount(Math.max(1, Math.min(304, +e.target.value)))}
                  />
                </div>
              )}

              <div className="divider" />

              <div style={{ marginBottom: '1rem', fontSize: '.9rem', color: 'var(--clr-neutral-600)' }}>
                <div>Bộ lọc đã chọn:</div>
                <div>• Tiêu chuẩn: <strong>{selStandard || 'Tất cả'}</strong></div>
                <div>• Bloom: <strong>{selBloom || 'Tất cả'}</strong></div>
                <div>• Phần: <strong>{selSections.length > 0 ? `${selSections.length} phần` : 'Tất cả'}</strong></div>
                {countMode !== 'all' && (
                  <div>• Số câu: <strong>{resolvedCount()}</strong></div>
                )}
              </div>

              <button
                className="btn btn-accent w-full btn-xl"
                onClick={handleStart}
                disabled={starting}
                aria-label="Bắt đầu luyện tập xáo trộn"
              >
                {starting ? '⏳ Đang tạo...' : '🚀 Bắt đầu luyện'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
