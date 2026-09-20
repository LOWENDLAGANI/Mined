// Mined — Client-side live-quiz service.
// NOTE: All authoritative operations (join, scoring) are performed by Cloud
// Functions (see functions/src/index.ts). The client only reads state and
// invokes callables; it never writes scores directly.
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
import type { AnswerDoc, GameSession, PlayerState, Pacing, Question } from './types';
import { QUIZ_ERRORS } from './format';

// Functions are deployed to asia-northeast1 (Tokyo) to sit next to Firestore.
const functions = getFunctions(undefined, 'asia-northeast1');

export type JoinResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string; technical?: string; hint?: string };

/** Shared developer hint for join failures. */
function joinHint(code: string, msg: string): string {
  if (code.includes('not-found') || msg.includes('not found'))
    return 'No session doc has this pin in gameSessions. Verify the PIN the teacher is showing and check the Firestore console for a doc with pin == the code (and status != finished).';
  if (msg.includes('already started')) return 'The session status is not "waiting" — students can only join before the quiz starts. Re-host or unlock by resetting status.';
  if (msg.includes('ended')) return 'The session status is "finished". Start a new session for another round.';
  if (msg.includes('locked')) return 'settings.joinLocked is true on the session doc. The teacher can unlock it from the lobby, or set it to false in the console.';
  if (msg.includes('removed')) return `A doc exists at gameSessions/{sessionId}/removed/{uid} — delete it to let this student back in.`;
  if (code.includes('unauthenticated')) return 'The callable was invoked without an auth context. Make sure the user is signed in before calling joinQuiz.';
  if (code.includes('permission')) return 'Firestore rules or the function rejected this user. Check the users/{uid} role and the callable\'s permission checks.';
  return 'Check the Cloud Functions logs for the full error: npx firebase-tools functions:log --project mined-2425';
}

export async function joinQuizByPin(
  pin: string,
  profile: { uid: string; displayName: string; photoURL: null; avatarId?: string } | null,
  guestName?: string
): Promise<JoinResult> {
  if (!firebaseConfigured) return { ok: false, error: 'Firebase is not configured. Add your .env keys and reload.' };
  try {
    const fn = httpsCallable<{ pin: string; displayName?: string }, { ok: true; sessionId: string; alreadyJoined?: boolean }>(
      functions,
      'joinQuiz'
    );
    const res = await fn({ pin: pin.trim().toUpperCase(), displayName: profile?.displayName ?? guestName });
    return { ok: true, sessionId: res.data.sessionId };
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code ?? '';
    const msg = (e as { message?: string })?.message ?? '';
    const technical = `joinQuiz callable: [${code || 'unknown'}] ${msg}`;
    const hint = joinHint(code, msg);
    if (code.includes('not-found') || msg.includes('not found')) return { ok: false, error: QUIZ_ERRORS.notFound, technical, hint };
    if (msg.includes('already started')) return { ok: false, error: QUIZ_ERRORS.alreadyStarted, technical, hint };
    if (msg.includes('ended')) return { ok: false, error: QUIZ_ERRORS.ended, technical, hint };
    if (msg.includes('locked')) return { ok: false, error: QUIZ_ERRORS.joinLocked, technical, hint };
    if (msg.includes('removed')) return { ok: false, error: QUIZ_ERRORS.kicked, technical, hint };
    if (code.includes('unauthenticated')) return { ok: false, error: 'Please sign in first.', technical, hint };
    if (code.includes('permission')) return { ok: false, error: 'You don’t have permission to join this quiz.', technical, hint };
    return { ok: false, error: 'Could not join. Check the PIN and try again.', technical, hint };
  }
}

export async function findSessionByPin(pin: string): Promise<GameSession | null> {
  const q = query(collection(db, 'gameSessions'), where('pin', '==', pin.trim().toUpperCase()), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : ({ ...(snap.docs[0].data() as GameSession), id: snap.docs[0].id });
}

export function subscribeSession(
  sessionId: string,
  cb: (s: GameSession | null) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'gameSessions', sessionId),
    (snap) => cb(snap.exists() ? ({ ...(snap.data() as GameSession), id: snap.id }) : null),
    (err) => { if (onError) onError(err); }
  );
}

export function subscribePlayers(
  sessionId: string,
  cb: (players: PlayerState[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'gameSessions', sessionId, 'players'), orderBy('score', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as PlayerState)),
    (err) => { if (onError) onError(err); }
  );
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

/** Student submits an answer via Cloud Function — server computes correctness/score.
 *  The response carries the reveal (correct option + explanation), which is the
 *  only way the client ever learns the answer key. */
export async function submitAnswer(sessionId: string, questionId: string, selectedOption: number) {
  const fn = httpsCallable<
    { sessionId: string; questionId: string; selectedOption: number },
    { ok: boolean; isCorrect?: boolean; pointsEarned?: number; streak?: number; next?: { index: number; endsAt: string } | null; finished?: boolean; reveal?: { correctOption: number; explanation: string } }
  >(functions, 'submitAnswer');
  return fn({ sessionId, questionId, selectedOption });
}

/** Self-paced: open the player's next question (fresh timer). */
export async function advanceSelfPaced(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean; finished?: boolean }>(functions, 'advanceSelfPaced');
  return fn({ sessionId });
}

/** Sanitized question fetch for players: no correctOption/explanation ever
 *  reaches the browser, so an inspecting student can't cheat. */
export async function getPlayQuestions(sessionId: string): Promise<PlayQuestion[]> {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean; questions: PlayQuestion[] }>(functions, 'getPlayQuestions');
  const res = await fn({ sessionId });
  return res.data.questions;
}

export interface PlayQuestion {
  id: string;
  question: string;
  options: string[];
  timeLimit: number;
  points: number;
}

export async function leaveSession(sessionId: string) {
  try {
    const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(functions, 'leaveQuiz');
    await fn({ sessionId });
  } catch {
    // best effort
  }
}

// ---------- Teacher session management ----------

/** Teacher creates a live session for a quiz in a chosen pacing (Cloud Function). */
export async function createGameSession(
  quizId: string,
  pacing: Pacing
): Promise<{ sessionId: string; pin: string }> {
  const fn = httpsCallable<{ quizId: string; pacing: Pacing }, { sessionId: string; pin: string }>(
    functions,
    'createQuizSession'
  );
  const res = await fn({ quizId, pacing });
  return res.data;
}

export async function startQuiz(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(functions, 'startQuiz');
  return fn({ sessionId });
}

export async function advanceQuestion(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(functions, 'advanceQuestion');
  return fn({ sessionId });
}

export async function endQuiz(sessionId: string) {
  const fn = httpsCallable<{ sessionId: string }, { ok: boolean }>(functions, 'finishQuiz');
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
