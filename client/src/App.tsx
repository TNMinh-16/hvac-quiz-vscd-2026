import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Language } from './types';
import { useLang } from './utils';

// Pages
import HomePage        from './pages/HomePage';
import SectionsPage    from './pages/SectionsPage';
import ShuffleSetupPage from './pages/ShuffleSetupPage';
import QuizPage        from './pages/QuizPage';
import ResultPage      from './pages/ResultPage';
import ReviewPage      from './pages/ReviewPage';
import HistoryPage     from './pages/HistoryPage';
import GuidePage       from './pages/GuidePage';

export default function App() {
  const [lang, setLang] = useLang();

  const LANG_LABELS: Record<Language, string> = {
    bilingual: '🌐 Song ngữ',
    en: '🇺🇸 English',
    vi: '🇻🇳 Tiếng Việt',
  };

  return (
    <>
      <nav className="navbar" role="navigation" aria-label="Điều hướng chính">
        <div className="navbar-inner">
          <NavLink to="/" className="navbar-brand" aria-label="Trang chủ HVAC Quiz">
            <div className="navbar-brand-icon" aria-hidden="true">🌬️</div>
            <span>HVAC Quiz</span>
          </NavLink>

          <div className="navbar-nav" role="list">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              role="listitem"
            >
              🏠 Trang chủ
            </NavLink>
            <NavLink
              to="/sections"
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              role="listitem"
            >
              📚 Theo phần
            </NavLink>
            <NavLink
              to="/shuffle"
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              role="listitem"
            >
              🔀 Xáo trộn
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              role="listitem"
            >
              📋 Lịch sử
            </NavLink>
            <NavLink
              to="/guide"
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
              role="listitem"
            >
              📖 Hướng dẫn
            </NavLink>
          </div>

          {/* Language switcher */}
          <div style={{ marginLeft: 'auto' }}>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
              style={{
                background: 'rgba(255,255,255,.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,.2)',
                borderRadius: 'var(--radius)',
                padding: '.35rem .6rem',
                fontSize: '.875rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
              aria-label="Chọn ngôn ngữ hiển thị"
            >
              <option value="bilingual" style={{ background: '#1a3a5c' }}>🌐 Song ngữ</option>
              <option value="en" style={{ background: '#1a3a5c' }}>🇺🇸 English</option>
              <option value="vi" style={{ background: '#1a3a5c' }}>🇻🇳 Tiếng Việt</option>
            </select>
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/"            element={<HomePage lang={lang} />} />
        <Route path="/sections"    element={<SectionsPage lang={lang} />} />
        <Route path="/shuffle"     element={<ShuffleSetupPage lang={lang} />} />
        <Route path="/quiz/:id"    element={<QuizPage lang={lang} />} />
        <Route path="/result/:id"  element={<ResultPage lang={lang} />} />
        <Route path="/review/:id"  element={<ReviewPage lang={lang} />} />
        <Route path="/history"     element={<HistoryPage lang={lang} />} />
        <Route path="/guide"       element={<GuidePage lang={lang} />} />
        <Route path="*"            element={<NotFound />} />
      </Routes>
    </>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="page text-center">
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <h2>Trang không tồn tại</h2>
        <p className="text-muted mt-2">Đường dẫn bạn truy cập không hợp lệ.</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>
          Về trang chủ
        </button>
      </div>
    </div>
  );
}
