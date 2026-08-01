// API client – all calls to /api/...
import type {
  Metadata, Section, Question, QuizSession, SessionFilters
} from './types';

const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Metadata ──────────────────────────────────────────────────────────
export const getMetadata = () => request<Metadata>('/metadata');
export const getSections = () => request<Section[]>('/sections');

// ─── Questions ─────────────────────────────────────────────────────────
export const getQuestions = (ids?: string[]) => {
  const qs = new URLSearchParams();
  if (ids) qs.set('ids', ids.join(','));
  return request<Question[]>(`/questions?${qs}`);
};

export const getSessionQuestions = (sessionId: string) =>
  request<Question[]>(`/sessions/${sessionId}/questions`);

// ─── Sessions ──────────────────────────────────────────────────────────
export const createSession = (params: {
  mode: 'sequential' | 'shuffled';
  sectionIds?: string[];
  filters?: SessionFilters;
}) => request<QuizSession>('/sessions', { method: 'POST', body: JSON.stringify(params) });

export const getInProgressSessions = () =>
  request<QuizSession[]>('/sessions/in-progress');

export const getRecentSessions = (limit = 5) =>
  request<QuizSession[]>(`/sessions/recent?limit=${limit}`);

export const getAllSessions = () => request<QuizSession[]>('/sessions');

export const getSession = (id: string) => request<QuizSession>(`/sessions/${id}`);

export const saveAnswers = (
  id: string,
  answers: Record<string, string>,
  durationSeconds: number
) =>
  request<{ ok: boolean }>(`/sessions/${id}/answers`, {
    method: 'PATCH',
    body: JSON.stringify({ answers, durationSeconds }),
  });

export const saveMarks = (id: string, markedQuestionIds: string[]) =>
  request<{ ok: boolean }>(`/sessions/${id}/marks`, {
    method: 'PATCH',
    body: JSON.stringify({ markedQuestionIds }),
  });

export const submitSession = (id: string, durationSeconds: number) =>
  request<QuizSession>(`/sessions/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ durationSeconds }),
  });

export const retryWrong = (id: string) =>
  request<QuizSession>(`/sessions/${id}/retry-wrong`, { method: 'POST', body: '{}' });
