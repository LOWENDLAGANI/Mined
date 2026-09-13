// MINED — Centralized asset configuration.
// All visual assets are referenced through APP_ASSETS / AVATARS / BOSS_ART.
// Replace placeholders by editing src/assets/textures.ts (or dropping real
// files into src/assets/textures/) — no component rewrites required.

export type AvatarDef = { id: string; label: string; color: string; emoji: string };

const COLORS = ['#6c5ce7', '#00b894', '#fd79a8', '#fdcb6e', '#0984e3', '#e17055', '#00cec9', '#d63031'];

export const AVATARS: AvatarDef[] = [
  { id: 'a1', label: 'Miner', color: COLORS[0], emoji: '⛏️' },
  { id: 'a2', label: 'Scout', color: COLORS[1], emoji: '🧭' },
  { id: 'a3', label: 'Star', color: COLORS[2], emoji: '⭐' },
  { id: 'a4', label: 'Sun', color: COLORS[3], emoji: '☀️' },
  { id: 'a5', label: 'Wave', color: COLORS[4], emoji: '🌊' },
  { id: 'a6', label: 'Flame', color: COLORS[5], emoji: '🔥' },
  { id: 'a7', label: 'Leaf', color: COLORS[6], emoji: '🌿' },
  { id: 'a7b', label: 'Ruby', color: COLORS[7], emoji: '💎' },
];

export function avatarById(id: string | null | undefined): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

export function avatarDataUrl(def: AvatarDef): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${def.color}"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="#fff" font-family="sans-serif">${def.emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function avatarUrl(id: string | null | undefined): string {
  return avatarDataUrl(avatarById(id));
}
