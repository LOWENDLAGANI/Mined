// Mined — Centralized scoring configuration.
// Points = base question points + speed bonus. Streaks apply within one
// session only; nothing carries over between live quizzes.

export const SCORING_CONFIG = {
  basePointsPerQuestion: 100,
  maxSpeedBonusPoints: 100,
  /** Streak bonus added per consecutive-correct step beyond 2, capped. */
  streakBonusXP: 25,
  streakBonusMax: 100,
} as const;
