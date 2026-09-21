// Mined — Client-side tracker for the student's most recent live-quiz session.
//
// WHY THIS EXISTS: the player's authoritative progress (score, question index,
// answers) already lives in Firestore under gameSessions/{id}/players/{uid}.
// What gets lost on refresh or app quit is only the ROUTE (/play/:sessionId).
// This module remembers that route so the student dashboard can offer
// "Continue where you left off" without re-entering the PIN.

const KEY = 'mined.activeSession';

export interface TrackedSession {
  sessionId: string;
  quizTitle: string;
  pin: string;
  savedAt: string; // ISO timestamp
}

export function saveActiveSession(s: Omit<TrackedSession, 'savedAt'>): void {
  try {
    const data: TrackedSession = { ...s, savedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private mode etc.) — resume just won't work.
  }
}

export function getActiveSession(): TrackedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackedSession;
    if (!parsed?.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Clear the tracked session — call on explicit leave, finish, or when the
 *  liveness check finds the session gone/ended. */
export function clearActiveSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
