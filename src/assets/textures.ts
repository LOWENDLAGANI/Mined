// Mined — Replaceable texture system.
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
    value: 'linear-gradient(180deg, #f4f1e8 0%, #efebdf 100%)',
    kind: 'css',
  },
  texture_panel: {
    value: 'linear-gradient(180deg, rgba(38, 35, 28, 0.015), rgba(38, 35, 28, 0.045))',
    kind: 'css',
  },
  texture_card: {
    value: 'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.2))',
    kind: 'css',
  },
  texture_button: {
    value: 'linear-gradient(180deg, #2a7a5e, #256d54)',
    kind: 'css',
  },
  texture_header: {
    value: 'linear-gradient(180deg, #fdfcf8, #f8f5ec)',
    kind: 'css',
  },
  texture_game_background: {
    value: 'linear-gradient(180deg, #f4f1e8 0%, #e9e4d4 100%)',
    kind: 'css',
  },
  texture_race_track: {
    value: 'linear-gradient(180deg, #fbf9f2 0%, #f1ecdd 100%)',
    kind: 'css',
  },
  texture_boss_arena: {
    value: 'linear-gradient(180deg, #f6efe2 0%, #eadfca 100%)',
    kind: 'css',
  },
  texture_treasure_map: {
    value: 'linear-gradient(180deg, #f0ecdc 0%, #e4deca 100%)',
    kind: 'css',
  },
  texture_modal: {
    value: 'linear-gradient(180deg, #fdfcf8, #f8f5ec)',
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
  { name: 'Professor Gneiss', emoji: '🧙', color: '#256d54' },
  { name: 'Countess Carbide', emoji: '🦇', color: '#c05b2e' },
  { name: 'The Kraken of Calculus', emoji: '🐙', color: '#34618f' },
  { name: 'Magma Wyrm', emoji: '🐉', color: '#b3402f' },
];

export function bossArtFor(difficulty: string): BossArt {
  const i = Math.max(0, BOSS_ART.findIndex((b) => b.name.toLowerCase().includes(difficulty.toLowerCase())));
  return BOSS_ART[i] ?? BOSS_ART[0];
}
