import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Language } from '../types';

interface Props { lang: Language }

export default function GuidePage({ lang }: Props) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<'all' | 'modes' | 'shortcuts' | 'security' | 'analytics' | 'local'>('all');

  const isVi = lang === 'vi' || lang === 'bilingual';

  return (
    <div className="page">
      <div className="container-wide">
        {/* Page Header Banner */}
        <div className="hero-banner" style={{ background: 'linear-gradient(135deg, var(--clr-primary-800) 0%, var(--clr-primary-600) 50%, var(--clr-accent-700) 100%)', marginBottom: '2rem' }}>
          <div className="hero-title">{isVi ? '📖 Hướng Dẫn Sử Dụng & Khai Thác Hệ Thống' : '📖 System User Guide & Features'}</div>
          <div className="hero-sub" style={{ maxWidth: '720px', marginBottom: '1.25rem' }}>
            {isVi 
              ? 'Cẩm nang toàn diện giúp bạn tối ưu thời gian ôn thi các tiêu chuẩn ASHRAE 52.2, 55, 62.1 và 90.1 với 3000 câu hỏi ngân hàng chính thức VSCD 2026.'
              : 'A comprehensive operational manual to help you efficiently study ASHRAE standards 52.2, 55, 62.1, and 90.1 using the complete 3000 bilingual question bank.'
            }
          </div>
          <div className="hero-chips">
            <span className="hero-chip">⚙️ Quản Trị Trắc Nghiệm</span>
            <span className="hero-chip">⌨️ Phím Tắt Siêu Nhanh</span>
            <span className="hero-chip">🛡️ Bảo Mật Lời Giải 403</span>
            <span className="hero-chip">📊 Thống Kê Theo Bloom</span>
          </div>
        </div>

        {/* Quick Filter Navigation */}
        <div className="flex gap-2 flex-wrap mb-6" style={{ marginBottom: '1.75rem' }}>
          {[
            { id: 'all', label: isVi ? '🌟 Toàn bộ cẩm nang' : '🌟 All Sections' },
            { id: 'modes', label: isVi ? '🎯 Chế độ Luyện đề' : '🎯 Study Modes' },
            { id: 'shortcuts', label: isVi ? '⌨️ Phím Tắt & Thao tác' : '⌨️ Shortcuts & Navigation' },
            { id: 'security', label: isVi ? '🛡️ Tự Động Lưu & Bảo Mật' : '🛡️ Autosave & Security' },
            { id: 'analytics', label: isVi ? '📈 Chấm Điểm & Phục Thù' : '📈 Analytics & Retry' },
            { id: 'local', label: isVi ? '💻 Khởi Động Trên PC' : '💻 Local PC Startup' },
          ].map((item) => (
            <button
              key={item.id}
              className={`btn btn-sm ${activeSection === item.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: '99px', padding: '0.45rem 1rem', fontSize: '0.875rem' }}
              onClick={() => setActiveSection(item.id as any)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Section Cards */}
        <div className="grid gap-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', marginBottom: '3rem' }}>

          {/* SECTION 1: STUDY MODES & DATA */}
          {(activeSection === 'all' || activeSection === 'modes') && (
            <div className="card card-hover" style={{ borderLeft: '5px solid var(--clr-primary-500)', padding: '1.75rem' }}>
              <div className="flex items-center gap-3 mb-3" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>📚</span>
                <div>
                  <h2 style={{ fontSize: '1.35rem', margin: 0 }}>
                    {isVi ? '1. Nguồn Dữ Liệu Chuẩn & Các Chế Độ Luyện Đề' : '1. Authentic Dataset & Flexible Study Modes'}
                  </h2>
                  <div className="text-sm text-muted">Ngân hàng 3000 câu hỏi VSCD 2026 chính thức song ngữ Anh – Việt</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                <div style={{ background: 'var(--clr-primary-50)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-primary-100)' }}>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--clr-primary-800)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📖 Luyện Theo Phần (Sequential)</span>
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6' }}>
                    Cho phép làm tuần tự từ Q001 đến E2696 theo đúng trình tự sách thi của ASHRAE. Bạn có thể bấm chọn riêng từng <strong>Cấp độ nhận thức Bloom</strong> (<em>Remember, Understand, Apply, Analyze, Evaluate, Create</em>) hoặc thi chuyên sâu vào các tiêu chuẩn con bên dưới (ASHRAE 52.2, 55, 62.1, 90.1).
                  </p>
                  <button className="btn btn-primary btn-sm mt-3" style={{ marginTop: '0.85rem' }} onClick={() => navigate('/sections')}>
                    Khám phá danh mục →
                  </button>
                </div>

                <div style={{ background: 'var(--clr-accent-100)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--clr-accent-300)' }}>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--clr-accent-700)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>🔀 Luyện Xáo Trộn Ngẫu Nhiên (Shuffled Custom)</span>
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6' }}>
                    Tái lập môi trường thi thử như phòng thi thực tế! Tự động tạo bài trắc nghiệm với số câu tùy chọn (10, 20, 50 hoặc trọn bộ). Hệ thống cho phép chắt lọc phối hợp cả Tiêu chuẩn cùng Cấp độ Bloom, sau đó trộn vị trí các câu hỏi để thử thách khả năng phản xạ và tránh học vẹt.
                  </p>
                  <button className="btn btn-primary btn-sm mt-3" style={{ marginTop: '0.85rem', background: 'var(--clr-accent-600)', borderColor: 'var(--clr-accent-600)' }} onClick={() => navigate('/shuffle')}>
                    Tạo đề ngẫu nhiên ngay →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: KEYBOARD SHORTCUTS & NAVIGATION */}
          {(activeSection === 'all' || activeSection === 'shortcuts') && (
            <div className="card card-hover" style={{ borderLeft: '5px solid var(--clr-info)', padding: '1.75rem' }}>
              <div className="flex items-center gap-3 mb-3" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>⌨️</span>
                <div>
                  <h2 style={{ fontSize: '1.35rem', margin: 0 }}>
                    {isVi ? '2. Phím Tắt Bàn Phím & Bảng Điều Hướng Khi Thi' : '2. Keyboard Shortcuts & Smart Quiz Navigation'}
                  </h2>
                  <div className="text-sm text-muted">Tối ưu tốc độ làm bài trên máy tính không cần rê chuột</div>
                </div>
              </div>

              <p style={{ color: 'var(--clr-neutral-700)', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
                Trong quá trình thi trắc nghiệm, hệ thống lắng nghe bàn phím theo thời gian thực. Bạn có thể sử dụng các phím tắt sau để chuyển câu và chọn đáp án tức thì:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'var(--clr-neutral-100)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--clr-neutral-200)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <span className="kbd">A</span><span className="kbd">B</span><span className="kbd">C</span><span className="kbd">D</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Chọn phương án</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--clr-neutral-500)' }}>Đánh dấu vào phương án A, B, C hoặc D</div>
                  </div>
                </div>

                <div style={{ background: 'var(--clr-neutral-100)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--clr-neutral-200)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <span className="kbd">←</span><span className="kbd">→</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>Chuyển câu hỏi</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--clr-neutral-500)' }}>Mũi tên trái / phải để sang trang</div>
                  </div>
                </div>

                <div style={{ background: 'var(--clr-neutral-100)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--clr-neutral-200)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <span className="kbd" style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#b45309' }}>M</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>🔖 Đánh dấu câu (Bookmark)</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--clr-neutral-500)' }}>Gắn thẻ câu khó để xem xét lại trước khi nộp</div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--clr-neutral-200)', paddingTop: '1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--clr-primary-900)', marginBottom: '0.5rem' }}>
                  🧭 Bảng Điều Hướng Trạng Thái (Quiz Sidebar)
                </h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--clr-neutral-700)', margin: 0 }}>
                  Góc phải màn hình thi luôn hiển thị bảng tọa độ số của tất cả câu hỏi trong chặng. Các số sẽ thay đổi màu sắc ngay khi bạn thao tác:
                  <span className="badge" style={{ background: '#f1f5f9', color: '#334155', margin: '0 0.35rem' }}>Trắng: Chưa làm</span>
                  <span className="badge badge-green" style={{ margin: '0 0.35rem' }}>Xanh lá: Đã có đáp án</span>
                  <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #f59e0b', margin: '0 0.35rem' }}>Cam: Đang đánh dấu 🔖</span>
                </p>
              </div>
            </div>
          )}

          {/* SECTION 3: AUTOSAVE & SECURITY */}
          {(activeSection === 'all' || activeSection === 'security') && (
            <div className="card card-hover" style={{ borderLeft: '5px solid var(--clr-warning)', padding: '1.75rem' }}>
              <div className="flex items-center gap-3 mb-3" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>🛡️</span>
                <div>
                  <h2 style={{ fontSize: '1.35rem', margin: 0 }}>
                    {isVi ? '3. Lưu Tự Động & Chống Gian Lận Đề Thi' : '3. Robust Autosave & Anti-Cheating Architecture'}
                  </h2>
                  <div className="text-sm text-muted">Bảo an toàn bộ tiến độ và khóa kín đáp án từ tầng máy chủ</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--clr-primary-900)', marginBottom: '0.5rem' }}>
                    ⏳ Lưu Tiến Độ Tự Động (Debounce Autosave)
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6' }}>
                    Khi bạn click chọn hoặc bấm phím tắt trả lời một câu hỏi, hệ thống sẽ đợi một nhịp (1,5 giây) để gom nhóm các thay đổi và tự động ghi vào tệp dữ liệu máy tính. Thanh thông báo phía trên sẽ hiện nhãn <span className="badge badge-blue">⏳ Đang lưu...</span> và chuyển thành <span className="badge badge-green">✓ Đã lưu</span>.
                  </p>
                  <div style={{ background: '#eff6ff', borderLeft: '3px solid var(--clr-primary-500)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', color: 'var(--clr-primary-800)', marginTop: '0.75rem' }}>
                    💡 <strong>Không bao giờ mất bài:</strong> Nếu lỡ tắt tab hay đóng laptop rớt pinกลาง chừng, lần sau mở trang chủ bạn sẽ thấy nút <strong>"Tiếp tục"</strong> ở danh sách bài thi đang làm dở!
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--clr-primary-900)', marginBottom: '0.5rem' }}>
                    🔒 Khóa Bảo Mật Đáp Án (Mã Lỗi 403)
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6' }}>
                    Để giữ vững kỷ luật khi ôn tập, toàn bộ dữ liệu truyền về phía trình duyệt khi làm bài sẽ bị loại bỏ hoàn toàn các trường đáp án gốc (<code>correctOptionId</code>) và lời giải (<code>explanation</code>). 
                  </p>
                  <p style={{ fontSize: '0.92rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6', marginTop: '0.5rem' }}>
                    Máy chủ nghiêm khắc chặn mọi nỗ lực truy thu lời giải trước thời gian xác nhận. Lời giải chi tiết gốc chỉ chính thức được cởi dỡ sau khi bạn bấm <strong>Nộp Bài (Submit)</strong>!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: ANALYTICS & REMEDIAL RETRY */}
          {(activeSection === 'all' || activeSection === 'analytics') && (
            <div className="card card-hover" style={{ borderLeft: '5px solid var(--clr-accent-500)', padding: '1.75rem' }}>
              <div className="flex items-center gap-3 mb-3" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>📈</span>
                <div>
                  <h2 style={{ fontSize: '1.35rem', margin: 0 }}>
                    {isVi ? '4. Phân Tích Điểm Số & Luyện Trúng Mục Tiêu' : '4. In-depth Analytics & Target Remediation'}
                  </h2>
                  <div className="text-sm text-muted">Hậu kiểm thông minh với thang đo Bloom và Tiêu chuẩn</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{ borderRight: '1px solid var(--clr-neutral-200)', paddingRight: '1rem' }}>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--clr-primary-900)', marginBottom: '0.5rem' }}>
                    📊 Thống Kê Điểm Sâu Theo Danh Mục
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6' }}>
                    Màn hình Kết Quả sau khi nộp bài không đơn thuần hiển thị điểm % tổng. Hệ thống lập tức bóc tách kết quả theo từng mục:
                  </p>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--clr-neutral-700)', lineHeight: '1.7', marginTop: '0.5rem' }}>
                    <li><strong>Theo Tiêu chuẩn ASHRAE:</strong> Bạn đang yếu ở ASHRAE 55 hay ASHRAE 90.1? Thang màu Đỏ (&lt;60%), Vàng (&lt;80%), Xanh (&gt;80%) hiển thị rõ rệt.</li>
                    <li><strong>Theo Cấp độ Bloom:</strong> Đánh giá mức độ làm chủ kiến thức từ Ghi nhớ thô sơ đến Phân tích, Đánh giá và Sáng tạo.</li>
                  </ul>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--clr-primary-900)', marginBottom: '0.5rem' }}>
                    🔄 Luyện Lại Các Câu Làm Sai (Remial Practice)
                  </h3>
                  <p style={{ fontSize: '0.92rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6' }}>
                    Đây là tính năng giá trị nhất để đẩy nhanh hiệu quả ôn thi: Tại màn hình Xem Lại Lời Giải (Review), bạn có thể dễ dàng chắt lọc riêng thẻ <strong>"Trả lời sai"</strong> hoặc thẻ <strong>"Đã đánh dấu 🔖"</strong>.
                  </p>
                  <div style={{ background: '#f8fafc', border: '1px dashed var(--clr-neutral-400)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--clr-primary-800)' }}>❌ Lại thi các câu làm sai</span>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/history')}>
                      Xem Lịch Sử Thi →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: DEPLOYMENT & STORAGE ARCHITECTURE */}
          {(activeSection === 'all' || activeSection === 'local') && (
            <div className="card card-hover" style={{ borderLeft: '5px solid var(--clr-neutral-700)', padding: '1.75rem' }}>
              <div className="flex items-center gap-3 mb-3" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>🌐</span>
                <div>
                  <h2 style={{ fontSize: '1.35rem', margin: 0 }}>
                    {isVi ? '5. Kiến Trúc Triển Khai Cloud & Vận Hành Local' : '5. Dual Cloud Deployment & Local Operations'}
                  </h2>
                  <div className="text-sm text-muted">Hỗ trợ trọn vẹn Supabase PostgreSQL Cloud và máy cá nhân Offline</div>
                </div>
              </div>

              <p style={{ color: 'var(--clr-neutral-700)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
                Dự án được thiết kế đặc biệt theo mô hình <strong>ôn thi cá nhân chuyên sâu</strong>: Hoàn toàn <strong>không yêu cầu đăng ký hay đăng nhập (No Auth)</strong>. Lịch sử làm bài trên cloud là một bộ <strong>Lịch sử chung toàn cầu</strong> lưu trên <strong>Supabase PostgreSQL</strong>, với các lớp bảo mật vững chắc:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1.125rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-neutral-200)' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--clr-primary-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>☁️</span> Triển khai Internet (Render & Supabase)
                  </h3>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6', margin: 0 }}>
                    <li><strong>Supabase PostgreSQL:</strong> Bảng <code>quiz_sessions</code> được bảo mật trong schema <code>private</code>, khóa hoàn toàn truy cập trực tiếp từ trình duyệt và REST API công cộng.</li>
                    <li><strong>Render Web Service:</strong> Máy chủ Node.js/Express kiểm soát 100% logic chấm bài, ẩn lời giải (Mã lỗi 403) và giao tiếp an toàn qua Connection Pooler (Cổng 6543).</li>
                    <li><strong>Chống Xung Đột & Idempotent:</strong> Tích hợp gộp Atomic JSONB (<code>||</code>), bảo đảm lưu tiến độ ngay cả khi đứt kết nối hoặc đóng trang web (<code>keepalive / sendBeacon</code>).</li>
                  </ul>
                </div>

                <div style={{ background: '#eff6ff', padding: '1.125rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-primary-200)' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--clr-primary-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>💻</span> Vận Hành Offline Tại Máy Bàn (Local PC)
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--clr-neutral-700)', lineHeight: '1.6', margin: '0 0 0.75rem 0' }}>
                    Khi chạy tại máy tính cá nhân ở chế độ <code>DATA_BACKEND=json</code>, hệ thống tự động lưu lịch sử vào <code>data/history.json</code> với tốc độ phản hồi 0ms:
                  </p>
                  <div style={{ background: 'var(--clr-neutral-900)', color: '#a5b4fc', padding: '0.75rem', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    <div style={{ color: '#d1fae5' }}>&gt; Nháy đúp lệnh: <strong>start.bat</strong></div>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '0.25rem', fontFamily: 'var(--font-sans)' }}>Tự mở server cổng 3000 và khởi chạy web ngay trên trình duyệt mà không cần cài đặt phức tạp!</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Call to Action */}
        <div style={{ textAlign: 'center', padding: '2rem 0', borderTop: '2px solid var(--clr-neutral-200)' }}>
          <h3 style={{ fontSize: '1.4rem', color: 'var(--clr-primary-900)', marginBottom: '0.5rem' }}>
            {isVi ? 'Bạn đã sẵn sàng thi trắc nghiệm HVAC chưa?' : 'Ready to begin practicing your HVAC standards?'}
          </h3>
          <p style={{ color: 'var(--clr-neutral-500)', marginBottom: '1.5rem', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>
            {isVi ? 'Chọn chế độ luyện tập phù hợp nhất và bắt đầu rèn luyện tay nghề tiêu chuẩn quốc tế.' : 'Select your favorite study mode and start mastering modern international ventilation standards.'}
          </p>
          <div className="flex justify-center gap-4">
            <button className="btn btn-primary" style={{ padding: '0.65rem 1.75rem', fontSize: '1rem' }} onClick={() => navigate('/sections')}>
              📚 Luyện theo từng phần
            </button>
            <button className="btn" style={{ background: 'var(--clr-accent-600)', color: '#fff', borderColor: 'var(--clr-accent-600)', padding: '0.65rem 1.75rem', fontSize: '1rem' }} onClick={() => navigate('/shuffle')}>
              🔀 Tạo đề thi ngẫu nhiên
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
