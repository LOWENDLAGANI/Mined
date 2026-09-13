// MINED — Centralized scoring / XP / level configuration.
// Balance the whole game economy here; never hard-code these elsewhere.

export const GAME_REWARD_CONFIG = {
  correctAnswerXP: 100,
  fastAnswerXP: 25,
  fastAnswerThresholdMs: 5000, // answers faster than this earn bonus XP
  gameCompletionXP: 100,
  winXP: 250,
  streakBonusXP: 25, // per streak step beyond 2, capped
  streakBonusMax: 100,
  basePointsPerQuestion: 100,
  maxSpeedBonusPoints: 100,
  treasureCoinPerCorrect: 50,
  raceStepPerCorrect: 0.12,
  raceSpeedBonusStep: 0.05,
  battleDamagePerCorrect: 25,
  battleSpeedBonusDamage: 10,
};

export const LEVEL_THRESHOLDS: number[] = (() => {
  // Level 1 = 0 XP, Level 2 = 500 XP, then +700 per level (500, 1200, 1900, ...)
  const t = [0];
  for (let lv = 2; lv <= 100; lv++) {
    t.push(lv === 2 ? 500 : t[t.length - 1] + 700);
  }
  return t;
})();

export function levelForXP(xp: number): number {
  let lv = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lv = i + 1;
  }
  return lv;
}

export function levelProgress(xp: number): {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  intoLevel: number;
  needed: number;
  progress: number; // 0..1
} {
  const level = levelForXP(xp);
  const currentXP = xp;
  const base = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextLevelXP = LEVEL_THRESHOLDS[level] ?? base + 700;
  const intoLevel = currentXP - base;
  const needed = nextLevelXP - base;
  return {
    level,
    currentXP,
    nextLevelXP,
    intoLevel,
    needed,
    progress: needed > 0 ? Math.min(1, intoLevel / needed) : 1,
  };
}
