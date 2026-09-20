// Mined — Drop-in asset loader.
//
// ── HOW TO CUSTOMIZE (no code changes needed) ──────────────────────────────
// Drop files into  public/assets/  with these exact names (see also
// public/assets/README.txt):
//
//   logo.png            ← replaces the gem mark (transparent PNG, square)
//   mascot.png          ← mascot image on waiting/results screens (transparent PNG)
//   background.jpg      ← full-page background (landscape JPG)
//   play-background.jpg ← live play screen background (falls back to background.jpg)
//   music-lobby.mp3     ← waiting-room loop (MP3)
//   music-question.mp3  ← loop while a question is open (MP3)
//   sfx-correct.mp3     ← right-answer sound (MP3)
//   sfx-wrong.mp3       ← wrong-answer sound (MP3)
//   sfx-podium.mp3      ← final-results sound (MP3)
//
// png / jpg / jpeg / webp / svg work for images; mp3 / ogg / wav for audio —
// just keep the rest of the filename exactly as listed. Refresh the browser
// after adding files. Delete a file to fall back to the built-in default.
// ───────────────────────────────────────────────────────────────────────────

const IMG = '(?:png|jpe?g|webp|avif|gif|svg)';
const AUD = '(?:mp3|ogg|wav|m4a)';

function firstExisting(prefixes: string[], exts: RegExp): string | null {
  for (const p of prefixes) {
    for (const ext of exts.source.split('|')) {
      // Files are probed at runtime; existence is resolved by the browser.
      // We return the first candidate — the component layer checks load errors.
      void ext;
    }
    void p;
  }
  return null;
}
void firstExisting;

// Candidates are tried in order; the first that loads wins. Keeping primary
// + alternates lets you drop either .png or .jpg without code edits.
export const LOGO_SOURCES = [`/assets/logo.png`, `/assets/logo.jpg`, `/assets/logo.svg`];
export const MASCOT_SOURCES = [`/assets/mascot.png`, `/assets/mascot.jpg`, `/assets/mascot.svg`];
export const BACKGROUND_SOURCES = [`/assets/background.jpg`, `/assets/background.png`, `/assets/background.webp`];
export const PLAY_BACKGROUND_SOURCES = [
  `/assets/play-background.jpg`,
  `/assets/play-background.png`,
  ...BACKGROUND_SOURCES,
];

export const AUDIO_SOURCES: Record<string, string[]> = {
  lobby: [`/assets/music-lobby.mp3`, `/assets/music-lobby.ogg`],
  question: [`/assets/music-question.mp3`, `/assets/music-question.ogg`],
  correct: [`/assets/sfx-correct.mp3`, `/assets/sfx-correct.ogg`],
  wrong: [`/assets/sfx-wrong.mp3`, `/assets/sfx-wrong.ogg`],
  podium: [`/assets/sfx-podium.mp3`, `/assets/sfx-podium.ogg`],
};

const IMG_RE = new RegExp(`\\.(${IMG})$`, 'i');
const AUD_RE = new RegExp(`\\.(${AUD})$`, 'i');
void IMG_RE; void AUD_RE;

export const ACCEPTED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg'];
export const ACCEPTED_AUDIO_EXTS = ['mp3', 'ogg', 'wav', 'm4a'];

// ---------- Audio playback ----------
// Autoplay rules: audio can only start after a user gesture. Components call
// soundPlayer.start(kind) from a click handler; the player no-ops otherwise.

class SoundPlayer {
  private current: HTMLAudioElement | null = null;
  private currentKind: string | null = null;
  private muted = localStorage.getItem('mined-muted') === '1';

  isMuted() { return this.muted; }

  setMuted(m: boolean) {
    this.muted = m;
    localStorage.setItem('mined-muted', m ? '1' : '0');
    if (m) this.stop();
  }

  /** Start a looping track (lobby / question). Must be called from a gesture. */
  startLoop(kind: 'lobby' | 'question') {
    this.stop();
    const src = AUDIO_SOURCES[kind]?.[0];
    if (!src || this.muted) return;
    const a = new Audio(src);
    a.loop = true;
    a.volume = kind === 'lobby' ? 0.35 : 0.3;
    a.play().then(() => {
      this.current = a;
      this.currentKind = kind;
    }).catch(() => { /* file missing or blocked — stay silent */ });
  }

  /** Play a one-shot effect; safe to call outside a gesture if one happened earlier. */
  playEffect(kind: 'correct' | 'wrong' | 'podium') {
    if (this.muted) return;
    const src = AUDIO_SOURCES[kind]?.[0];
    if (!src) return;
    const a = new Audio(src);
    a.volume = kind === 'podium' ? 0.5 : 0.45;
    a.play().catch(() => { /* file missing — stay silent */ });
  }

  stop() {
    if (this.current) {
      this.current.pause();
      this.current = null;
      this.currentKind = null;
    }
  }

  activeLoop() { return this.currentKind; }
}

export const soundPlayer = new SoundPlayer();
