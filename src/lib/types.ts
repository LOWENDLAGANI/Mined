// Mined — Shared Firestore document types.

export type Role = 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  role: Role;
  displayName: string;
  email: string;
  photoURL: null;
  avatarId?: string;
  totalCorrect: number;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  quizId?: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation?: string;
  timeLimit: number; // seconds
  points: number;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Quiz {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  coverImage: null;
  published: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

/** How a live quiz is paced. */
export type Pacing = 'classic' | 'self_paced';

export type SessionStatus = 'waiting' | 'countdown' | 'question_active' | 'question_results' | 'finished';

export interface SessionSettings {
  basePoints: number;
  speedBonus: boolean;
  maxSpeedBonus: number;
  showLeaderboard: boolean;
  joinLocked: boolean;
}

export interface GameSession {
  id: string;
  pin: string; // 5-character join code
  quizId: string;
  quizTitle: string;
  teacherId: string;
  pacing: Pacing;
  status: SessionStatus;
  settings: SessionSettings;
  questionCount: number;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  questionEndsAt: string | null;
  /** Server-published answer key for the PREVIOUS/closed question. Only set
   *  once the question window has closed — never during active play. */
  lastReveal?: { correctOption: number; explanation: string } | null;
  /** Set when the session finishes: uids of the winner(s). */
  winners?: string[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface PlayerState {
  uid: string;
  displayName: string;
  photoURL: null;
  avatarId?: string;
  score: number;
  correctAnswers: number;
  questionsAnswered: number;
  streak: number;
  currentGameState: string;
  // Self-paced progress: which question this player is on and its deadline.
  playerQuestionIndex?: number;
  playerQuestionEndsAt?: string | null;
  playerStatus?: 'playing' | 'finished';
  joinedAt: string;
  lastActiveAt: string;
}

export interface AnswerDoc {
  uid: string;
  questionId: string;
  questionIndex: number;
  selectedOption: number | null;
  answeredAt: string;
  responseTime: number;
  isCorrect: boolean;
  pointsEarned: number;
  streakAfter?: number;
}

/** Written by the server when a session finishes — one per player. */
export interface GameResultDoc {
  sessionId: string;
  quizId: string;
  teacherId: string;
  uid: string;
  displayName: string;
  avatarId?: string;
  rank: number;
  score: number;
  correctAnswers: number;
  questionsAnswered: number;
  accuracy: number;
  streak: number;
  createdAt: string;
  // Denormalized from the session doc for easy listing.
  quizTitle?: string;
}
