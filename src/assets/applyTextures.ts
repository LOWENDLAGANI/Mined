// MINED — Applies texture slots to CSS variables at startup.
// Keeps styles.css static while letting user-dropped images in
// src/assets/textures/ flow to every page automatically.
import { APP_ASSETS } from './textures';

function asCssBackground(slot: { value: string; kind: 'css' | 'image' }): string {
  return slot.kind === 'image' ? `url("${slot.value}")` : slot.value;
}

export function applyTextureVariables(): void {
  const root = document.documentElement;
  if (APP_ASSETS.texture_background) {
    root.style.setProperty('--app-bg', asCssBackground(APP_ASSETS.texture_background));
  }
  if (APP_ASSETS.texture_header) {
    root.style.setProperty('--tex-header', asCssBackground(APP_ASSETS.texture_header));
  }
}
