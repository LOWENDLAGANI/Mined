// Mined — Client-side game service.
// NOTE: All authoritative operations (join, scoring, progression) are performed
// by Cloud Functions (see functions/src/index.ts). The client only reads state
// and invokes callables; it never writes scores/XP/game state directly.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, firebaseConfigured } from './firebase';
import type { AnswerDoc, GameMode, GameSession, PlayerState, Question } from './types';
import { GAME_ERRORS } from './format';

// Functions are deployed to asia-northeast1 (Tokyo) to sit next to Firestore.
const functions = getFunctions(undefined, 'asia-northeast1');

export type JoinResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

export async function joinGameByCode(
  gameCode: string,
  profile: { uid: string; displayName: string; photoURL: null; avatarId?: string } | null,
  guestName?: string
): Promise<JoinResult> {
  if (!firebaseConfigured) return { ok: false, error: 'Firebase is not configured. Add your .env keys and reload.' };
  try {
    const fn = httpsCallable<{ gameCode: string; displayName?: string }, { ok: true; sessionId: string; alreadyJoined?: boolean }>(
      functions,
      'joinGame'
    );
    const res = await fn({ gameCode: gameCode.trim().toUpperCase(), displayName: profile?.displayName ?? guestName });
    return { ok: true, sessionId: res.data.sessionId };
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code ?? '';
    const msg = (e as { message?: string })?.message ?? '';
    if (code.includes('not-found') || msg.includes('Game not found')) return { ok: false, error: GAME_ERRORS.notFound };
    if (msg.includes('already started')) return { ok: false, error: GAME_ERRORS.alreadyStarted };
    if (msg.includes('ended')) return { ok: false, error: GAME_ERRORS.ended };
    if (msg.includes('locked')) return { ok: false, error: GAME_ERRORS.joinLocked };
    if (msg.includes('removed')) return { ok: false, error: GAME_ERRORS.kicked };
    if (code.includes('unauthenticated')) return { ok: false, error: 'Please sign in first.' };
    if (code.includes('permission')) return { ok: false, error: 'You don’t have permission to join this game.' };
    return { ok: false, error: 'Could not join the game. Check the code and try again.' };
  }
}

export async function findSessionByCode(gameCode: string): Promise<GameSession | null> {
  const q = query(collection(db, 'gameSessions'), where('gameCode', '==', gameCode.trim().toUpperCase()), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : ({ ...(snap.docs[0].data() as GameSession), id: snap.docs[0].id });
}

export function subscribeSession(sessionId: string, cb: (s: GameSession | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'gameSessions', sessionId), (snap) =>
    cb(snap.exists() ? ({ ...(snap.data() as GameSession), id: snap.id }) : null)
  );
}

export function subscribePlayers(sessionId: string, cb: (players: PlayerState[]) => void): Unsubscribe {
  const q = query(collection(db, 'gameSessions', sessionId, 'players'), orderBy('score', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as PlayerState)));
}

export function subscribeMyPlayer(sessionId: string, uid: string, cb: (p: PlayerState | null) => void): Unsubscribe {
  return onSnapshot(doc(db, 'gameSessions', sessionId, 'players', uid), (snap) =>
    cb(snap.exists() ? (snap.data() as PlayerState) : null)
  );
}

export async function getSessionQuestions(quizId: string): Promise<Question[]> {
  const snap = await getDocs(collection(db, 'quizzes', quizId, 'questions'));
  const questions = snap.docs.map((d) => ({ ...(d.data() as Question), id: d.id }));
  questions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return questions;
}

/** Student submits an answer via Cloud Function — server computes correctness/score. */
export async function submitAnswer(sessionId: string, questionId: string, selectedOption: number) {
  const fn = httpsCallable<{ sessionId: string; questionId: string; selectedOption: number }, { ok: boolean; isCorrect?: boolean; pointsEarned?: number; xpEarned?: number; streak?: number }>(
    functions,
    'submitAnswer'
  );
  return fn({ sessionId, questionId, selectedOption });
}

export async function leaveSession(sessionId: string) {
  try {
    const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(functions, 'leaveGame');
    await fn({ sessionId });
  } catch {
    // best effort
  }
}

// ---------- Teacher session management ----------

/** Teacher creates a live session for a quiz in a chosen mode (Cloud Function). */
export async function createGameSession(
  quizId: string,
  gameMode: GameMode,
  settingsOverrides?: Partial<GameSession['settings']>
): Promise<{ sessionId: string; gameCode: string }> {
  const fn = httpsCallable<{ quizId: string; gameMode: GameMode; settings?: Partial<GameSession['settings']> }, { sessionId: string; gameCode: string }>(
    functions,
    'createGameSession'
  );
  const res = await fn({ quizId, gameMode, settings: settingsOverrides });
  return res.data;
}

export async function startGame(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(functions, 'startGame');
  return fn({ sessionId });
}

export async function advanceQuestion(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(functions, 'advanceQuestion');
  return fn({ sessionId });
}

export async function endGame(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(functions, 'finishGame');
  return fn({ sessionId });
}

export async function removePlayer(sessionId: string, playerUid: string) {
  const fn = httpsCallable<{ sessionId: string; playerUid: string }, { ok: boolean }>(functions, 'removePlayer');
  return fn({ sessionId, playerUid });
}

export async function lockJoining(sessionId: string, locked: boolean) {
  const fn = httpsCallable<{ sessionId: string; locked: boolean }, { ok: boolean }>(functions, 'setJoinLock');
  return fn({ sessionId, locked });
}

// ---------- Results / leaderboard reads ----------

export async function getSessionAnswers(sessionId: string): Promise<AnswerDoc[]> {
  const snap = await getDocs(collection(db, 'gameSessions', sessionId, 'answers'));
  return snap.docs.map((d) => d.data() as AnswerDoc);
}

export function subscribeSessionLeaderboard(sessionId: string, cb: (players: PlayerState[]) => void): Unsubscribe {
  const q = query(collection(db, 'gameSessions', sessionId, 'players'), orderBy('score', 'desc'), limit(50));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as PlayerState)));
}
