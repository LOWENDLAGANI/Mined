// MINED — Replaceable texture system.
//
// ── HOW TO CUSTOMIZE (no code changes needed) ──────────────────────────────
// Drop an image into  src/assets/textures/  and name it exactly after a slot:
//
//   texture_background.png      ← every page background
//   texture_panel.png           ← dashboard panels
//   texture_card.png            ← quiz / mode / info cards
//   texture_button.png          ← primary buttons (gradient looks better)
//   texture_header.png          ← top navigation bar
//   texture_game_background.png ← live gameplay screens
//   texture_race_track.png      ← Race mode track
//   texture_boss_arena.png      ← Battle / Boss Battle arena
//   texture_treasure_map.png    ← Treasure Hunt map
//   texture_modal.png           ← popup dialogs
//
// png / jpg / jpeg / webp all work. Restart `npm run dev` after adding.
// Delete the file (or rename it) to fall back to the built-in placeholder.
//
// Developers can also override slots in code below (the file map wins).
// ───────────────────────────────────────────────────────────────────────────

export interface TextureSlot {
  /** CSS background value OR image URL. */
  value: string;
  /** 'css' = use as background shorthand; 'image' = object-fit image */
  kind: 'css' | 'image';
  /** For image kind: 'cover' | 'contain' | 'tile' */
  fit?: 'cover' | 'contain' | 'tile';
}

// ── Built-in placeholders (CSS gradients) ──────────────────────────────────
const PLACEHOLDERS: Record<string, TextureSlot> = {
  texture_background: {
    value: 'radial-gradient(1200px 800px at 20% -10%, #2d2b55 0%, transparent 60%), radial-gradient(1000px 700px at 110% 20%, #1b3a5c 0%, transparent 55%), linear-gradient(160deg, #0b0f1e 0%, #101830 100%)',
    kind: 'css',
  },
  texture_panel: {
    value: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
    kind: 'css',
  },
  texture_card: {
    value: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.04))',
    kind: 'css',
  },
  texture_button: {
    value: 'linear-gradient(180deg, #7d6ff2, #5a48d6)',
    kind: 'css',
  },
  texture_header: {
    value: 'linear-gradient(180deg, rgba(11,15,30,0.9), rgba(11,15,30,0.7))',
    kind: 'css',
  },
  texture_game_background: {
    value: 'radial-gradient(900px 600px at 50% -20%, #33265e 0%, transparent 60%), linear-gradient(180deg, #0d1226 0%, #131a38 100%)',
    kind: 'css',
  },
  texture_race_track: {
    value: 'linear-gradient(180deg, #14203f 0%, #1a2a52 100%)',
    kind: 'css',
  },
  texture_boss_arena: {
    value: 'radial-gradient(700px 500px at 50% 30%, #4a1f3d 0%, transparent 65%), linear-gradient(180deg, #12081a 0%, #1d0f2e 100%)',
    kind: 'css',
  },
  texture_treasure_map: {
    value: 'linear-gradient(180deg, #13322e 0%, #1a4a40 100%)',
    kind: 'css',
  },
  texture_modal: {
    value: 'linear-gradient(180deg, rgba(20,26,52,0.98), rgba(14,18,38,0.98))',
    kind: 'css',
  },
};

// ── Auto-load user images from src/assets/textures/ ───────────────────────
// Vite bundles every image in that folder; we pick the one whose filename
// matches a slot name. Unknown files are ignored.
const modules = import.meta.glob<string>(
  './textures/texture_*.{png,jpg,jpeg,webp,avif,gif,svg}',
  { eager: true, query: '?url', import: 'default' },
);

const USER_FILES: Record<string, TextureSlot> = {};
for (const [path, url] of Object.entries(modules)) {
  const match = path.match(/texture_[a-z_]+\.(?:png|jpe?g|webp|avif|gif|svg)$/i);
  if (!match) continue;
  const slotName = match[0].replace(/\.(png|jpe?g|webp|avif|gif|svg)$/i, '');
  // Full-bleed backgrounds should cover; small surfaces tile or contain.
  const isFullscreen = slotName.endsWith('_background');
  USER_FILES[slotName] = {
    value: url,
    kind: 'image',
    fit: isFullscreen ? 'cover' : 'tile',
  };
}

/** Final slots: user files override placeholders. */
export const APP_ASSETS: Record<string, TextureSlot> = {
  ...PLACEHOLDERS,
  ...USER_FILES,
};

// Boss art per difficulty. Replace with real images (kind: 'image', fit: 'contain').
export interface BossArt {
  name: string;
  emoji: string;
  color: string;
}

export const BOSS_ART: BossArt[] = [
  { name: 'Professor Gneiss', emoji: '🧙', color: '#6c5ce7' },
  { name: 'Countess Carbide', emoji: '🦇', color: '#e17055' },
  { name: 'The Kraken of Calculus', emoji: '🐙', color: '#0984e3' },
  { name: 'Magma Wyrm', emoji: '🐉', color: '#d63031' },
];

export function bossArtFor(difficulty: string): BossArt {
  const i = Math.max(0, BOSS_ART.findIndex((b) => b.name.toLowerCase().includes(difficulty.toLowerCase())));
  return BOSS_ART[i] ?? BOSS_ART[0];
}
