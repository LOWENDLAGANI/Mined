// Mined — Shared Firestore document types.

export type Role = 'teacher' | 'student';

export interface UserProfile {
  uid: string;
  role: Role;
  displayName: string;
  email: string;
  photoURL: null;
  avatarId?: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  gamesPlayed: number;
  gamesWon: number;
  totalCorrect: number;
  totalQuestions: number;
  lastPlayedAt?: string;
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

export type GameMode = 'classic' | 'race' | 'battle' | 'boss' | 'treasure' | 'survival' | 'team';

export type SessionStatus = 'waiting' | 'countdown' | 'question_active' | 'question_results' | 'finished';

export interface SessionSettings {
  basePoints: number;
  speedBonus: boolean;
  maxSpeedBonus: number;
  showLeaderboard: boolean;
  joinLocked: boolean;
  // mode specific
  startLives?: number; // survival
  bossHp?: number; // boss
  bossName?: string; // boss
  bossEmoji?: string; // boss
  teamCount?: number; // team
  finishDistance?: number; // race
  totalCoins?: number; // treasure
}

export interface GameSession {
  id: string;
  gameCode: string;
  quizId: string;
  quizTitle: string;
  teacherId: string;
  gameMode: GameMode;
  status: SessionStatus;
  settings: SessionSettings;
  questionCount: number;
  currentQuestionIndex: number;
  questionStartedAt: string | null;
  questionEndsAt: string | null;
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
  xpEarned: number;
  correctAnswers: number;
  questionsAnswered: number;
  streak: number;
  eliminated?: boolean;
  lives?: number; // survival
  position?: number; // race progress 0..1
  teamId?: string; // team
  coins?: number; // treasure
  locationsUnlocked?: number; // treasure
  currentGameState: string;
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
  xpEarned: number;
  streakAfter?: number;
  modeEvent?: Record<string, unknown>;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: string;
}

export interface GameResultDoc {
  sessionId: string;
  quizId: string;
  gameMode: GameMode;
  uid: string;
  displayName: string;
  avatarId?: string;
  rank: number;
  score: number;
  correctAnswers: number;
  questionsAnswered: number;
  accuracy: number;
  xpEarned: number;
  won: boolean;
  streak: number;
  achievementsUnlocked: string[];
  createdAt: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_game', name: 'First Game', description: 'Complete your first game.', icon: '🎮' },
  { id: 'perfect', name: 'Perfect', description: 'Answer every question correctly in a game.', icon: '💯' },
  { id: 'on_fire', name: 'On Fire', description: 'Get 10 correct answers in a row.', icon: '🔥' },
  { id: 'champion', name: 'Champion', description: 'Win your first game.', icon: '🏆' },
  { id: 'century', name: 'Century', description: 'Earn 100 XP.', icon: '💎' },
  { id: 'legend', name: 'Legend', description: 'Reach Level 10.', icon: '👑' },
  { id: 'survivor', name: 'Survivor', description: 'Win a Survival game.', icon: '🛡️' },
  { id: 'boss_slayer', name: 'Boss Slayer', description: 'Deal the killing blow to a boss.', icon: '⚔️' },
];
