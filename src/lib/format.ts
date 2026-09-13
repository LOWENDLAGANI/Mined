/// <reference types="vite/client" />

// MINED — shared formatting helpers + friendly error mapping.

export interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

export interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function modeLabel(mode: string): string {
  const labels: Record<string, string> = {
    classic: 'Classic',
    race: 'Race',
    battle: 'Battle',
    boss: 'Boss Battle',
    treasure: 'Treasure Hunt',
    survival: 'Survival',
    team: 'Team Battle',
  };
  return labels[mode] ?? mode;
}

export function modeIcon(mode: string): string {
  const icons: Record<string, string> = {
    classic: '🎯',
    race: '🏁',
    battle: '⚔️',
    boss: '🐉',
    treasure: '🗺️',
    survival: '💀',
    team: '🤝',
  };
  return icons[mode] ?? '🎮';
}

/** Map Firebase errors to friendly messages (spec §40). */
export function friendlyAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password is too weak — use at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/network-request-failed': 'You appear to be offline. Check your connection.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

export function friendlyFirestoreError(code: string): string {
  const map: Record<string, string> = {
    'permission-denied': 'You don’t have permission to do that.',
    'unavailable': 'Can’t reach the game servers. Check your connection.',
    'not-found': 'That content could not be found.',
    'already-exists': 'That already exists.',
    'failed-precondition': 'That action isn’t available right now.',
    'aborted': 'The action was interrupted. Try again.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

export const GAME_ERRORS = {
  notFound: 'Game not found.',
  alreadyStarted: 'This game has already started.',
  ended: 'This game has ended.',
  joinLocked: 'The teacher has locked joining.',
  kicked: 'The teacher removed you from the game.',
} as const;
