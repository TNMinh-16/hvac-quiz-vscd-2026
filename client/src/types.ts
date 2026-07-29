// Types shared across the application

export interface QuestionOption {
  id: string;         // "A" | "B" | "C" | "D"
  en: string;
  vi: string;
}

export interface Question {
  id: string;
  order: number;
  sectionId: string;
  standard: string;
  bloomLevel: string;
  topic: { en: string; vi: string };
  stem: { en: string; vi: string };
  options: QuestionOption[];
  correctOptionId?: string;      // absent during active quiz
  explanation?: { en: string; vi: string };
  sourceText?: string;
  images: string[];
}

export interface Section {
  id: string;
  order: number;
  titleEn: string;
  titleVi: string;
  level: number;
  bloomLevel: string | null;
  standard: string | null;
  parentId: string | null;
  questionIds: string[];
}

export interface Metadata {
  questionCount: number;
  sectionCount: number;
  standards: string[];
  bloomLevels: string[];
  importedAt: string;
  sha256: string;
}

export type SessionStatus = 'in_progress' | 'completed';
export type SessionMode   = 'sequential' | 'shuffled';

export interface SessionFilters {
  sectionIds?: string[];
  standard?: string;
  bloomLevel?: string;
  count?: number;
  retryFrom?: string;
}

export interface QuizSession {
  id: string;
  status: SessionStatus;
  mode: SessionMode;
  startedAt: string;
  completedAt: string | null;
  sectionIds: string[];
  filters: SessionFilters;
  questionOrder: string[];
  answers: Record<string, string>;
  markedQuestionIds: string[];
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  scorePercent: number;
  durationSeconds: number;
}

export type Language = 'bilingual' | 'en' | 'vi';
