// Mined — Game mode definitions (QUIZ DATA ≠ GAME MODE).
// Each mode declares display metadata + its gameplay hooks' parameters.
// The engine in src/game/engine.ts consumes these; adding a future mode
// means adding an entry here + handlers, without touching quizzes.

import type { GameMode, SessionSettings } from './types';

export interface GameModeDef {
  id: GameMode;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  /** Default settings merged into a session when started in this mode. */
  defaultSettings: Partial<SessionSettings>;
  /** Which visuals the play screen should render. */
  features: Array<'track' | 'hp' | 'boss' | 'map' | 'lives' | 'teams'>;
}

export const GAME_MODES: Record<GameMode, GameModeDef> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    tagline: 'The timeless quiz showdown',
    description: 'Answer questions, earn points and speed bonuses. Climb the leaderboard.',
    icon: '🎯',
    color: '#6c5ce7',
    defaultSettings: { basePoints: 100, speedBonus: true, maxSpeedBonus: 100, showLeaderboard: true },
    features: [],
  },
  race: {
    id: 'race',
    name: 'Race',
    tagline: 'Sprint to the finish line',
    description: 'Correct answers move your racer forward. Speed matters twice over.',
    icon: '🏁',
    color: '#00b894',
    defaultSettings: { basePoints: 100, speedBonus: true, maxSpeedBonus: 100, finishDistance: 10, showLeaderboard: true },
    features: ['track'],
  },
  battle: {
    id: 'battle',
    name: 'Battle',
    tagline: 'Duel your classmates',
    description: 'Every player has HP. Correct answers attack — wrong answers defend nothing.',
    icon: '⚔️',
    color: '#e17055',
    defaultSettings: { basePoints: 100, speedBonus: true, maxSpeedBonus: 100, showLeaderboard: true },
    features: ['hp'],
  },
  boss: {
    id: 'boss',
    name: 'Boss Battle',
    tagline: 'The class vs the boss',
    description: 'Team up against one giant boss. Every correct answer damages it. Defeat it together.',
    icon: '🐉',
    color: '#d63031',
    defaultSettings: {
      basePoints: 100,
      speedBonus: true,
      maxSpeedBonus: 100,
      bossHp: 0, // computed at start: questionCount * players * 30
      bossName: 'Professor Gneiss',
      bossEmoji: '🧙',
      showLeaderboard: true,
    },
    features: ['boss'],
  },
  treasure: {
    id: 'treasure',
    name: 'Treasure Hunt',
    tagline: 'Explore and collect',
    description: 'Correct answers earn coins and unlock new map locations hiding treasure.',
    icon: '🗺️',
    color: '#fdcb6e',
    defaultSettings: { basePoints: 100, speedBonus: true, maxSpeedBonus: 100, totalCoins: 8, showLeaderboard: true },
    features: ['map'],
  },
  survival: {
    id: 'survival',
    name: 'Survival',
    tagline: 'Last one standing wins',
    description: 'You have limited lives. Every wrong answer costs one. Zero lives = eliminated.',
    icon: '💀',
    color: '#0984e3',
    defaultSettings: { basePoints: 100, speedBonus: true, maxSpeedBonus: 100, startLives: 3, showLeaderboard: true },
    features: ['lives'],
  },
  team: {
    id: 'team',
    name: 'Team Battle',
    tagline: 'Blue vs Red vs Green',
    description: 'Your correct answers power your team. The strongest team wins.',
    icon: '🤝',
    color: '#00cec9',
    defaultSettings: { basePoints: 100, speedBonus: true, maxSpeedBonus: 100, teamCount: 3, showLeaderboard: true },
    features: ['teams'],
  },
};

export const GAME_MODE_LIST: GameModeDef[] = Object.values(GAME_MODES);

export const TEAM_COLORS = [
  { id: 'blue', name: 'Team Blue', color: '#0984e3', emoji: '🔵' },
  { id: 'red', name: 'Team Red', color: '#d63031', emoji: '🔴' },
  { id: 'green', name: 'Team Green', color: '#00b894', emoji: '🟢' },
  { id: 'yellow', name: 'Team Yellow', color: '#fdcb6e', emoji: '🟡' },
];

export const TREASURE_LOCATIONS = [
  { id: 'l1', name: 'Crystal Cove', emoji: '💎' },
  { id: 'l2', name: 'Whispering Woods', emoji: '🌲' },
  { id: 'l3', name: 'Sunken Ruins', emoji: '🏛️' },
  { id: 'l4', name: 'Misty Peaks', emoji: '⛰️' },
  { id: 'l5', name: 'Ember Desert', emoji: '🏜️' },
  { id: 'l6', name: 'Frozen Fjord', emoji: '🧊' },
  { id: 'l7', name: 'Sky Temple', emoji: '⛩️' },
  { id: 'l8', name: 'Golden Vault', emoji: '🏆' },
];
