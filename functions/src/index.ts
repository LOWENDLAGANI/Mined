// Mined — Cloud Functions (trusted backend).
//
// SECURITY MODEL
// The client NEVER computes correctness or score. Clients can only call these
// callables and read sanitized docs (no answer keys). All writes to session
// state and scores happen here via Admin SDK.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Keep functions co-located with the Firestore database (Tokyo).
// All callables + triggers deploy to asia-northeast1, right next to the DB.
setGlobalOptions({ region: 'asia-northeast1' });

initializeApp();
const db = getFirestore();

// ============================
// Scoring config (server truth)
// ============================
const SCORING = {
  basePointsPerQuestion: 100,
  maxSpeedBonusPoints: 100,
  streakBonusXP: 25,
  streakBonusMax: 100,
};

const PIN_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I/L

function generatePin(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += PIN_ALPHABET[Math.floor(Math.random() * PIN_ALPHABET.length)];
  }
  return code;
}

async function generateUniquePin(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generatePin();
    // NOTE: no inequality filter here — combining `==` with `!=` on another
    // field would require a composite index and crash the function (INTERNAL).
    const snap = await db.collection('gameSessions').where('pin', '==', code).get();
    const stillActive = snap.docs.some((d) => (d.data() as { status?: string }).status !== 'finished');
    if (!stillActive) return code;
  }
  throw new HttpsError('internal', 'Could not generate a unique PIN.');
}

// ============================
// Profile provisioning (covers Google sign-in)
// ============================
export const ensureProfile = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (snap.exists) return { ok: true, created: false };

  const user = await getAuth().getUser(uid);
  const now = new Date().toISOString();
  await ref.set({
    uid,
    role: 'student',
    displayName: user.displayName || 'Student',
    email: user.email ?? '',
    photoURL: user.photoURL ?? null,
    avatarId: 'a1',
    totalCorrect: 0,
    totalQuestions: 0,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, created: true };
});

// ============================
// createQuizSession (teacher)
// ============================
export const createQuizSession = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const { quizId, pacing } = (request.data ?? {}) as { quizId?: string; pacing?: string };
  if (!quizId || !pacing) throw new HttpsError('invalid-argument', 'Missing quizId or pacing.');
  if (pacing !== 'classic' && pacing !== 'self_paced') {
    throw new HttpsError('invalid-argument', 'Unknown pacing.');
  }

  const quizRef = db.collection('quizzes').doc(quizId);
  const quizSnap = await quizRef.get();
  if (!quizSnap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const quiz = quizSnap.data()!;
  if (quiz.ownerId !== uid) throw new HttpsError('permission-denied', 'You do not own this quiz.');
  if (quiz.published !== true) throw new HttpsError('failed-precondition', 'Publish the quiz first.');

  const questionsSnap = await quizRef.collection('questions').get();
  const questionCount = questionsSnap.size;
  if (questionCount === 0) throw new HttpsError('failed-precondition', 'Add at least one question first.');

  const pin = await generateUniquePin();
  const now = new Date().toISOString();

  const ref = await db.collection('gameSessions').add({
    pin,
    quizId,
    quizTitle: quiz.title,
    teacherId: uid,
    pacing,
    status: 'waiting',
    questionCount,
    currentQuestionIndex: 0,
    questionStartedAt: null,
    questionEndsAt: null,
    settings: {
      basePoints: SCORING.basePointsPerQuestion,
      speedBonus: true,
      maxSpeedBonus: SCORING.maxSpeedBonusPoints,
      showLeaderboard: true,
      joinLocked: false,
    },
    createdAt: now,
    startedAt: null,
    endedAt: null,
  });
  return { sessionId: ref.id, pin };
});

// ============================
// getPlayQuestions (any session participant)
//
// ANTI-CHEAT: returns the question list with `correctOption` and `explanation`
// stripped. The client can render options but can never learn the answer key.
// Correctness is revealed only via the submitAnswer result or the
// server-written `lastReveal` doc.
// ============================
export const getPlayQuestions = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');

  const sessSnap = await db.collection('gameSessions').doc(sessionId).get();
  if (!sessSnap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const session = sessSnap.data()!;

  // Only the hosting teacher or an actual player of this session may read.
  if (session.teacherId !== uid) {
    const playerSnap = await sessSnap.ref.collection('players').doc(uid).get();
    if (!playerSnap.exists) throw new HttpsError('permission-denied', 'You are not in this quiz.');
  }

  const questionsSnap = await db.collection('quizzes').doc(session.quizId).collection('questions').orderBy('order', 'asc').get();
  const questions = questionsSnap.docs.map((d) => {
    const q = d.data() as { question?: string; options?: string[]; timeLimit?: number; points?: number };
    return {
      id: d.id,
      question: q.question ?? '',
      options: q.options ?? [],
      timeLimit: q.timeLimit ?? 20,
      points: q.points ?? SCORING.basePointsPerQuestion,
      // NOTE: correctOption and explanation deliberately omitted.
    };
  });
  return { ok: true, questions };
});

// ============================
// joinQuiz (student)
// ============================
export const joinQuiz = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Please sign in first.');

  const { pin, displayName } = (request.data ?? {}) as { pin?: string; displayName?: string };
  if (!pin || typeof pin !== 'string' || pin.length !== 5) {
    throw new HttpsError('invalid-argument', 'Enter a 5-character PIN.');
  }

  const code = pin.trim().toUpperCase();
  const sessSnap = await db.collection('gameSessions').where('pin', '==', code).limit(1).get();
  if (sessSnap.empty) throw new HttpsError('not-found', 'Quiz not found.');
  const sessRef = sessSnap.docs[0].ref;
  const session = sessSnap.docs[0].data();
  const settings = (session.settings ?? {}) as Record<string, unknown>;

  if (session.status === 'finished') throw new HttpsError('failed-precondition', 'This quiz has ended.');
  if (session.status !== 'waiting') throw new HttpsError('failed-precondition', 'This quiz has already started.');
  if (settings.joinLocked === true) throw new HttpsError('permission-denied', 'Joining is locked.');
  const removedDoc = await sessRef.collection('removed').doc(uid).get();
  if (removedDoc.exists) throw new HttpsError('permission-denied', 'You were removed from this quiz.');

  const playerRef = sessRef.collection('players').doc(uid);
  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.data();
  if (!user) throw new HttpsError('failed-precondition', 'Profile missing. Try logging out and in again.');

  const now = new Date().toISOString();
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) {
    await playerRef.set({
      uid,
      displayName: displayName || user.displayName,
      photoURL: user.photoURL ?? null,
      avatarId: user.avatarId ?? 'a1',
      score: 0,
      correctAnswers: 0,
      questionsAnswered: 0,
      streak: 0,
      currentGameState: 'waiting',
      playerQuestionIndex: session.pacing === 'self_paced' ? -1 : null,
      playerQuestionEndsAt: null,
      playerStatus: 'playing',
      joinedAt: now,
      lastActiveAt: now,
    });
  }

  return { ok: true, sessionId: sessRef.id };
});

// ============================
// startQuiz (teacher)
// ============================
export const startQuiz = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');

  const ref = db.collection('gameSessions').doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const s = snap.data()!;
  if (s.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can start the quiz.');
  if (s.status !== 'waiting') throw new HttpsError('failed-precondition', 'Quiz already started.');

  if (s.pacing === 'self_paced') {
    await ref.update({
      status: 'question_active',
      startedAt: new Date().toISOString(),
      currentQuestionIndex: 0,
    });
    // Open question 1 for every player individually (their own timers).
    const playersSnap = await ref.collection('players').get();
    const batch = db.batch();
    const startedAt = new Date().toISOString();
    const endsAt = await computeEndsAt(s.quizId, 0);
    playersSnap.forEach((p) => {
      batch.update(p.ref, { playerQuestionIndex: 0, playerQuestionEndsAt: endsAt, currentGameState: 'question' });
    });
    await batch.commit();
    void startedAt;
  } else {
    await ref.update({
      status: 'countdown',
      startedAt: new Date().toISOString(),
      currentQuestionIndex: 0,
    });
    // After a 3-second countdown, open question 1.
    setTimeout(() => void openQuestion(sessionId, 0), 3000);
  }
  return { ok: true };
});

async function computeEndsAt(quizId: string, index: number): Promise<string> {
  const qSnap = await db.collection('quizzes').doc(quizId).collection('questions').orderBy('order', 'asc').get();
  const qDoc = qSnap.docs[index];
  const timeLimit = qDoc ? Math.max(5, Math.min(120, (qDoc.data() as { timeLimit?: number }).timeLimit ?? 20)) : 20;
  return new Date(Date.now() + timeLimit * 1000).toISOString();
}

// ============================
// Question flow (classic pacing: teacher-driven + server timing)
// ============================
async function openQuestion(sessionId: string, index: number) {
  const sessRef = db.collection('gameSessions').doc(sessionId);
  const sessSnap = await sessRef.get();
  if (!sessSnap.exists) return;
  const s = sessSnap.data()!;
  if (s.status === 'finished') return;

  const quizSnap = await db.collection('quizzes').doc(s.quizId).get();
  if (!quizSnap.exists) return;
  const questionsSnap = await quizSnap.ref.collection('questions').orderBy('order', 'asc').get();
  const questions = questionsSnap.docs;
  if (index >= questions.length) {
    await finishSession(sessRef, s);
    return;
  }
  const q = questions[index].data() as { timeLimit?: number };
  const timeLimit = Math.max(5, Math.min(120, q.timeLimit ?? 20));
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + timeLimit * 1000);

  // Reset every player's answered flag so the host's "X / N answered" counter
  // restarts at 0 for the new question.
  const playersSnap = await sessRef.collection('players').get();
  const resetBatch = db.batch();
  playersSnap.forEach((p) => resetBatch.update(p.ref, { currentGameState: 'waiting' }));
  await resetBatch.commit();

  await sessRef.update({
    status: 'question_active',
    currentQuestionIndex: index,
    questionStartedAt: startedAt.toISOString(),
    questionEndsAt: endsAt.toISOString(),
    // Clear the previous question's reveal so clients never see a stale key.
    lastReveal: FieldValue.delete(),
  });

  // Server-side deadline: auto-close the question.
  const ms = Math.max(0, endsAt.getTime() - Date.now());
  setTimeout(() => void closeQuestion(sessionId, index), ms + 250);
}

async function closeQuestion(sessionId: string, index: number) {
  const sessRef = db.collection('gameSessions').doc(sessionId);
  const snap = await sessRef.get();
  if (!snap.exists) return;
  const s = snap.data()!;
  if (s.status !== 'question_active' || s.currentQuestionIndex !== index) return;

  // Publish the reveal server-side (correct option + explanation) so students
  // can see the answer without ever having received the key up front.
  const quizSnap = await db.collection('quizzes').doc(s.quizId).get();
  let reveal: { correctOption: number; explanation: string } | null = null;
  if (quizSnap.exists) {
    const qSnap = await quizSnap.ref.collection('questions').orderBy('order', 'asc').get();
    const qDoc = qSnap.docs[index];
    if (qDoc) {
      const q = qDoc.data() as { correctOption?: number; explanation?: string };
      reveal = { correctOption: q.correctOption ?? 0, explanation: q.explanation ?? '' };
    }
  }
  await sessRef.update({
    status: 'question_results',
    lastReveal: reveal ?? FieldValue.delete(),
  });
}

export const advanceQuestion = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');

  const sessRef = db.collection('gameSessions').doc(sessionId);
  const snap = await sessRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const s = snap.data()!;
  if (s.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can advance.');
  if (s.pacing !== 'classic') throw new HttpsError('failed-precondition', 'Not a teacher-paced quiz.');
  if (!['question_active', 'question_results', 'countdown'].includes(s.status)) {
    throw new HttpsError('failed-precondition', 'Cannot advance from current state.');
  }
  // From the lobby countdown, advanceQuestion opens question 1 (index 0).
  const nextIndex = s.status === 'countdown' ? 0 : (s.currentQuestionIndex ?? 0) + 1;
  await openQuestion(sessionId, nextIndex);
  return { ok: true };
});

// ============================
// advanceSelfPaced (student) — open the player's next question
// ============================
export const advanceSelfPaced = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');

  const sessRef = db.collection('gameSessions').doc(sessionId);
  const sessSnap = await sessRef.get();
  if (!sessSnap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const session = sessSnap.data()!;
  if (session.pacing !== 'self_paced') throw new HttpsError('failed-precondition', 'Not a self-paced quiz.');
  if (session.status === 'finished') return { ok: true, finished: true };

  const playerRef = sessRef.collection('players').doc(uid);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw new HttpsError('permission-denied', 'You are not in this quiz.');

  const questionsSnap = await db.collection('quizzes').doc(session.quizId).collection('questions').orderBy('order', 'asc').get();
  const total = questionsSnap.size;
  const nextIndex = (playerSnap.data()!.playerQuestionIndex as number ?? -1) + 1;

  if (nextIndex >= total) {
    await playerRef.update({ playerStatus: 'finished', currentGameState: 'finished', lastActiveAt: new Date().toISOString() });
    return { ok: true, finished: true };
  }

  const endsAt = await computeEndsAt(session.quizId, nextIndex);
  await playerRef.update({
    playerQuestionIndex: nextIndex,
    playerQuestionEndsAt: endsAt,
    currentGameState: 'question',
    lastActiveAt: new Date().toISOString(),
  });
  return { ok: true, finished: false };
});

// ============================
// submitAnswer (student) — server-authoritative
// ============================
export const submitAnswer = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const { sessionId, questionId, selectedOption } = (request.data ?? {}) as {
    sessionId?: string; questionId?: string; selectedOption?: number;
  };
  if (!sessionId || !questionId || typeof selectedOption !== 'number') {
    throw new HttpsError('invalid-argument', 'Invalid submission.');
  }

  const sessRef = db.collection('gameSessions').doc(sessionId);
  const sessSnap = await sessRef.get();
  if (!sessSnap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const session = sessSnap.data()!;
  if (session.status === 'finished') {
    throw new HttpsError('failed-precondition', 'This quiz has ended.');
  }

  const isSelfPaced = session.pacing === 'self_paced';

  // Which question is "active" for this student?
  let activeIndex: number;
  let endsAtMs: number;
  let startedAtMs: number;
  if (isSelfPaced) {
    const playerSnap = await sessRef.collection('players').doc(uid).get();
    if (!playerSnap.exists) throw new HttpsError('permission-denied', 'You are not in this quiz.');
    const p = playerSnap.data()!;
    activeIndex = (p.playerQuestionIndex as number) ?? -1;
    if (activeIndex < 0) throw new HttpsError('failed-precondition', 'Your question is not open yet.');
    endsAtMs = p.playerQuestionEndsAt ? new Date(p.playerQuestionEndsAt as string).getTime() : 0;
    startedAtMs = endsAtMs - (await questionTimeLimit(session.quizId, activeIndex)) * 1000;
  } else {
    if (session.status !== 'question_active') {
      throw new HttpsError('failed-precondition', 'Not currently accepting answers.');
    }
    activeIndex = session.currentQuestionIndex ?? 0;
    endsAtMs = session.questionEndsAt ? new Date(session.questionEndsAt).getTime() : 0;
    startedAtMs = session.questionStartedAt ? new Date(session.questionStartedAt).getTime() : Date.now();
  }

  // Validate question belongs to the active quiz & index.
  const quizRef = db.collection('quizzes').doc(session.quizId);
  const questionsSnap = await quizRef.collection('questions').orderBy('order', 'asc').get();
  const docs = questionsSnap.docs;
  if (activeIndex >= docs.length || docs[activeIndex].id !== questionId) {
    throw new HttpsError('failed-precondition', 'That question is not active.');
  }
  const questionDoc = docs[activeIndex];
  const q = questionDoc.data() as {
    correctOption: number; points?: number; timeLimit?: number; explanation?: string;
  };

  // Deadline check (server time is authoritative).
  const nowMs = Date.now();
  if (nowMs > endsAtMs + 500) {
    throw new HttpsError('deadline-exceeded', 'Time is up for this question.');
  }

  const playerRef = sessRef.collection('players').doc(uid);
  const answerRef = sessRef.collection('answers').doc(`${uid}_${questionId}`); // dedupe by ID

  const result = await db.runTransaction(async (tx) => {
    const [playerSnap, existingAnswer] = await Promise.all([tx.get(playerRef), tx.get(answerRef)]);
    if (!playerSnap.exists) throw new HttpsError('permission-denied', 'You are not in this quiz.');
    if (existingAnswer.exists) throw new HttpsError('already-exists', 'You already answered this question.');
    const player = playerSnap.data()!;

    const settings = (session.settings ?? {}) as Record<string, unknown>;
    const isCorrect = selectedOption === q.correctOption;
    const questionTimeLimit = Math.max(5, Math.min(120, q.timeLimit ?? 20));
    const responseTime = Math.max(0, Math.min(nowMs - startedAtMs, questionTimeLimit * 1000)) / 1000;

    // ---- Scoring (server-only) ----
    const basePoints = (q.points as number) ?? SCORING.basePointsPerQuestion;
    const speedBonusEnabled = settings.speedBonus !== false;
    const speedFrac = Math.max(0, 1 - responseTime / questionTimeLimit);
    const speedBonus = speedBonusEnabled ? Math.round(speedFrac * ((settings.maxSpeedBonus as number) ?? SCORING.maxSpeedBonusPoints)) : 0;
    const pointsEarned = isCorrect ? basePoints + speedBonus : 0;

    // Streak (within this session only)
    const streak = isCorrect ? (player.streak ?? 0) + 1 : 0;
    const streakBonus = isCorrect && streak > 2
      ? Math.min(SCORING.streakBonusMax, SCORING.streakBonusXP * Math.min(streak - 2, 4))
      : 0;

    const updates: Record<string, unknown> = {
      score: FieldValue.increment(pointsEarned + streakBonus),
      correctAnswers: FieldValue.increment(isCorrect ? 1 : 0),
      questionsAnswered: FieldValue.increment(1),
      streak,
      currentGameState: 'answered',
      lastActiveAt: new Date().toISOString(),
    };

    const answerData = {
      uid,
      questionId,
      questionIndex: activeIndex,
      selectedOption,
      answeredAt: new Date().toISOString(),
      responseTime,
      isCorrect,
      pointsEarned,
      streakAfter: streak,
    };

    tx.set(answerRef, answerData);
    tx.update(playerRef, updates);

    return {
      isCorrect,
      pointsEarned,
      streak,
      reveal: { correctOption: q.correctOption, explanation: (q as { explanation?: string }).explanation ?? '' },
    };
  });

  // Lifetime accuracy counters on the profile.
  await db.collection('users').doc(uid).update({
    totalCorrect: FieldValue.increment(result.isCorrect ? 1 : 0),
    totalQuestions: FieldValue.increment(1),
    updatedAt: new Date().toISOString(),
  }).catch(() => {});

  // Self-paced: leave the player on the CURRENT question with state
  // 'answered'. The client's "Continue" button calls advanceSelfPaced, which
  // opens the next question (index + 1) with a fresh timer. We must NOT
  // pre-advance the index here — that used to both hide the Continue button
  // (state was 'results', not 'answered') and make advanceSelfPaced skip a
  // question (it computes nextIndex = playerQuestionIndex + 1).
  if (isSelfPaced) {
    await sessRef.collection('players').doc(uid).update({
      currentGameState: 'answered',
      lastActiveAt: new Date().toISOString(),
    });
  }

  return { ok: true, ...result, next: null, finished: false };
});

async function questionTimeLimit(quizId: string, index: number): Promise<number> {
  const qSnap = await db.collection('quizzes').doc(quizId).collection('questions').orderBy('order', 'asc').get();
  const qDoc = qSnap.docs[index];
  return qDoc ? Math.max(5, Math.min(120, (qDoc.data() as { timeLimit?: number }).timeLimit ?? 20)) : 20;
}

// ============================
// finishQuiz (teacher)
// ============================
export const finishQuiz = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');

  const sessRef = db.collection('gameSessions').doc(sessionId);
  const snap = await sessRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const s = snap.data()!;
  if (s.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can finish the quiz.');
  if (s.status === 'finished') return { ok: true };

  await finishSession(sessRef, s);
  return { ok: true };
});

async function finishSession(sessRef: FirebaseFirestore.DocumentReference, s: FirebaseFirestore.DocumentData) {
  const sessionId = sessRef.id;
  const settings = (s.settings ?? {}) as Record<string, unknown>;

  // Atomically claim the finish so concurrent paths award players exactly once.
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessRef);
    if (!snap.exists) return false;
    const cur = snap.data()!;
    if (cur.status === 'finished') return false;
    tx.update(sessRef, { status: 'finished', endedAt: new Date().toISOString() });
    return true;
  });
  if (!claim) return;

  // Rank players by score.
  const playersSnap = await sessRef.collection('players').get();
  const players = playersSnap.docs.map((d) => d.data() as Record<string, unknown>);
  const ranked = [...players].sort((a, b) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0));
  const bestScore = ranked.length > 0 ? ((ranked[0].score as number) ?? 0) : 0;
  const winnerUids = ranked.filter((p) => ((p.score as number) ?? 0) === bestScore).map((p) => p.uid as string);

  const batch = db.batch();
  ranked.forEach((p, i) => {
    const uid = p.uid as string;
    const resultRef = db.collection('gameResults').doc(`${sessionId}_${uid}`);
    batch.set(resultRef, {
      sessionId,
      quizId: s.quizId,
      quizTitle: s.quizTitle ?? '',
      teacherId: s.teacherId,
      uid,
      displayName: p.displayName,
      avatarId: p.avatarId ?? null,
      rank: i + 1,
      score: p.score ?? 0,
      correctAnswers: p.correctAnswers ?? 0,
      questionsAnswered: p.questionsAnswered ?? 0,
      accuracy: ((p.questionsAnswered as number) ?? 0) > 0 ? ((p.correctAnswers as number) ?? 0) / ((p.questionsAnswered as number) ?? 1) : 0,
      streak: p.streak ?? 0,
      createdAt: new Date().toISOString(),
    });
  });
  await batch.commit();

  await sessRef.update({
    winners: winnerUids,
    settings: { ...settings, joinLocked: true },
  });
}

// ============================
// Host utilities
// ============================
export const removePlayer = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId, playerUid } = (request.data ?? {}) as { sessionId?: string; playerUid?: string };
  if (!sessionId || !playerUid) throw new HttpsError('invalid-argument', 'Missing ids.');

  const sessRef = db.collection('gameSessions').doc(sessionId);
  const snap = await sessRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  if (snap.data()!.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can remove players.');

  await sessRef.collection('players').doc(playerUid).delete();
  await sessRef.collection('removed').doc(playerUid).set({ removedAt: new Date().toISOString() });
  return { ok: true };
});

export const setJoinLock = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId, locked } = (request.data ?? {}) as { sessionId?: string; locked?: boolean };
  if (!sessionId || typeof locked !== 'boolean') throw new HttpsError('invalid-argument', 'Missing args.');

  const sessRef = db.collection('gameSessions').doc(sessionId);
  const snap = await sessRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  if (snap.data()!.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can lock joining.');

  await sessRef.update({ 'settings.joinLocked': locked });
  return { ok: true };
});

export const leaveQuiz = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');
  await db.collection('gameSessions').doc(sessionId).collection('players').doc(uid).delete();
  return { ok: true };
});
