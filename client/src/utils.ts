// Shared utility hooks and helpers
import { useState, useEffect, useRef } from 'react';
import type { Language } from './types';

// ─── Language display ───────────────────────────────────────────────────
export function useLang(): [Language, (l: Language) => void] {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('hvac-lang') as Language) || 'bilingual';
  });
  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem('hvac-lang', l);
  };
  return [lang, setLang];
}

export function bilingual(
  obj: { en: string; vi: string } | undefined,
  lang: Language
): string {
  if (!obj) return '';
  if (lang === 'en') return obj.en || obj.vi;
  if (lang === 'vi') return obj.vi || obj.en;
  return obj.en || obj.vi; // bilingual shows en first (vi shown separately)
}

// ─── Timer (elapsed seconds) ────────────────────────────────────────────
export function useTimer(initialSeconds = 0, running = true) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      setSeconds(initialSeconds); // sync with any updated initial value
      ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  return seconds;
}

// ─── Format timer ────────────────────────────────────────────────────────
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Format date ─────────────────────────────────────────────────────────
export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Bloom color ─────────────────────────────────────────────────────────
export function bloomColor(bloom: string): string {
  const b = (bloom || '').toLowerCase();
  if (b.includes('remember'))   return 'badge-blue';
  if (b.includes('understand')) return 'badge-green';
  if (b.includes('apply'))      return 'badge-orange';
  if (b.includes('analyze'))    return 'badge-orange';
  if (b.includes('evaluate'))   return 'badge-red';
  if (b.includes('create'))     return 'badge-red';
  return 'badge-gray';
}

// ─── Standard short name ─────────────────────────────────────────────────
export function stdShort(std: string): string {
  if (!std) return '';
  const m = std.match(/ASHRAE\s+([\d.]+)/i);
  return m ? `ASHRAE ${m[1]}` : std;
}

// ─── Score color ─────────────────────────────────────────────────────────
export function scoreColor(pct: number): string {
  if (pct >= 80) return 'var(--clr-success)';
  if (pct >= 60) return 'var(--clr-warning)';
  return 'var(--clr-error)';
}
