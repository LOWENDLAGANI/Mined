// Mined — Cloud Functions (trusted backend).
//
// SECURITY MODEL
// The client NEVER computes correctness, score, XP, streaks or progression.
// Clients can only call these callables and read sanitized docs (no answer keys).
// All writes to game state, scores, XP, achievements happen here via Admin SDK.
//
// Business rules live in src/lib/scoring.ts on the frontend as a shared
// reference; the values below mirror GAME_REWARD_CONFIG so server is the
// single source of truth in production.

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
// Centralized reward config (server truth)
// ============================
const GAME_REWARD_CONFIG = {
  correctAnswerXP: 100,
  fastAnswerXP: 25,
  fastAnswerThresholdMs: 5000,
  gameCompletionXP: 100,
  winXP: 250,
  streakBonusXP: 25,
  streakBonusMax: 100,
  basePointsPerQuestion: 100,
  maxSpeedBonusPoints: 100,
  treasureCoinPerCorrect: 50,
  raceStepPerCorrect: 0.12,
  raceSpeedBonusStep: 0.05,
  battleDamagePerCorrect: 25,
  battleSpeedBonusDamage: 10,
  bossHpPerPlayerPerQuestion: 30,
};

const GAME_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I/L
const PLAYER_DEFAULT_HP = 3; // survival lives & battle HP hearts
const LEVEL_STEP_XP = 700; // level 2 = 500, then +700 each (matches lib/scoring)

function levelForXP(xp: number): number {
  let level = 1;
  let threshold = 0;
  if (xp >= 500) {
    level = 2;
    threshold = 500;
    while (xp >= threshold + LEVEL_STEP_XP) {
      threshold += LEVEL_STEP_XP;
      level++;
    }
  }
  return level;
}

// ============================
// Game code generation
// ============================
function generateGameCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += GAME_CODE_ALPHABET[Math.floor(Math.random() * GAME_CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueGameCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateGameCode();
    const snap = await db.collection('gameSessions').where('gameCode', '==', code).where('status', '!=', 'finished').limit(1).get();
    if (snap.empty) return code;
  }
  throw new HttpsError('internal', 'Could not generate a unique game code.');
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
    role: 'student', // Google sign-ins default to student; teacher requires email registration flow
    displayName: user.displayName || 'Player',
    email: user.email ?? '',
    photoURL: user.photoURL ?? null,
    avatarId: 'a1',
    xp: 0,
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, created: true };
});

// ============================
// createGameSession (teacher)
// ============================
export const createGameSession = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const { quizId, gameMode, settings } = (request.data ?? {}) as {
    quizId?: string; gameMode?: string; settings?: Record<string, unknown>;
  };
  if (!quizId || !gameMode) throw new HttpsError('invalid-argument', 'Missing quizId or gameMode.');

  const VALID_MODES = ['classic', 'race', 'battle', 'boss', 'treasure', 'survival', 'team'];
  if (!VALID_MODES.includes(gameMode)) throw new HttpsError('invalid-argument', 'Unknown game mode.');

  const quizRef = db.collection('quizzes').doc(quizId);
  const quizSnap = await quizRef.get();
  if (!quizSnap.exists) throw new HttpsError('not-found', 'Quiz not found.');
  const quiz = quizSnap.data()!;
  if (quiz.ownerId !== uid) throw new HttpsError('permission-denied', 'You do not own this quiz.');
  if (quiz.published !== true) throw new HttpsError('failed-precondition', 'Publish the quiz first.');

  const questionsSnap = await quizRef.collection('questions').get();
  const questionCount = questionsSnap.size;
  if (questionCount === 0) throw new HttpsError('failed-precondition', 'Add at least one question first.');

  const playerEstimate = Math.max(4, (settings?.playerEstimate as number) ?? 8);
  const gameCode = await generateUniqueGameCode();
  const now = new Date().toISOString();

  const sessionData: Record<string, unknown> = {
    gameCode,
    quizId,
    quizTitle: quiz.title,
    teacherId: uid,
    gameMode,
    status: 'waiting',
    questionCount,
    currentQuestionIndex: 0,
    questionStartedAt: null,
    questionEndsAt: null,
    settings: settings ?? {},
    createdAt: now,
    startedAt: null,
    endedAt: null,
  };

  // Mode-specific defaults (kept in sync with src/lib/gameModes.ts)
  const s = sessionData.settings as Record<string, unknown>;
  if (settings?.basePoints === undefined) s.basePoints = GAME_REWARD_CONFIG.basePointsPerQuestion;
  if (settings?.speedBonus === undefined) s.speedBonus = true;
  if (settings?.maxSpeedBonus === undefined) s.maxSpeedBonus = GAME_REWARD_CONFIG.maxSpeedBonusPoints;
  if (settings?.showLeaderboard === undefined) s.showLeaderboard = true;
  if (settings?.joinLocked === undefined) s.joinLocked = false;
  if (gameMode === 'boss') {
    s.bossHp = questionCount * playerEstimate * GAME_REWARD_CONFIG.bossHpPerPlayerPerQuestion;
    if (s.bossName === undefined) s.bossName = 'Professor Gneiss';
    if (s.bossEmoji === undefined) s.bossEmoji = '🧙';
  }
  if (gameMode === 'survival' && s.startLives === undefined) s.startLives = PLAYER_DEFAULT_HP;
  if (gameMode === 'battle' && s.startHp === undefined) s.startHp = PLAYER_DEFAULT_HP;
  if (gameMode === 'race' && s.finishDistance === undefined) s.finishDistance = 10;
  if (gameMode === 'treasure' && s.totalCoins === undefined) s.totalCoins = 8;
  if (gameMode === 'team' && s.teamCount === undefined) s.teamCount = 3;

  const ref = await db.collection('gameSessions').add(sessionData);
  return { sessionId: ref.id, gameCode };
});

// ============================
// getPlayQuestions (any game participant)
//
// ANTI-CHEAT: returns the question list with `correctOption` and `explanation`
// stripped. The client can render options but can never learn the answer key —
// matching how Kahoot/Quizizz serve player devices. Correctness is revealed
// only via the submitAnswer result or the server-written `lastReveal` doc.
// ============================
export const getPlayQuestions = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');

  const sessSnap = await db.collection('gameSessions').doc(sessionId).get();
  if (!sessSnap.exists) throw new HttpsError('not-found', 'Game not found.');
  const session = sessSnap.data()!;

  // Only the hosting teacher or an actual player of this session may read.
  if (session.teacherId !== uid) {
    const playerSnap = await sessSnap.ref.collection('players').doc(uid).get();
    if (!playerSnap.exists) throw new HttpsError('permission-denied', 'You are not in this game.');
  }

  const questionsSnap = await db.collection('quizzes').doc(session.quizId).collection('questions').orderBy('order', 'asc').get();
  const questions = questionsSnap.docs.map((d) => {
    const q = d.data() as { question?: string; options?: string[]; timeLimit?: number; points?: number };
    return {
      id: d.id,
      question: q.question ?? '',
      options: q.options ?? [],
      timeLimit: q.timeLimit ?? 20,
      points: q.points ?? GAME_REWARD_CONFIG.basePointsPerQuestion,
      // NOTE: correctOption and explanation deliberately omitted.
    };
  });
  return { ok: true, questions };
});

// ============================
// joinGame (student)
// ============================
export const joinGame = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Please sign in first.');

  const { gameCode } = (request.data ?? {}) as { gameCode?: string };
  if (!gameCode || typeof gameCode !== 'string' || gameCode.length !== 5) {
    throw new HttpsError('invalid-argument', 'Enter a 5-character game code.');
  }

  const code = gameCode.trim().toUpperCase();
  const sessSnap = await db.collection('gameSessions').where('gameCode', '==', code).limit(1).get();
  if (sessSnap.empty) throw new HttpsError('not-found', 'Game not found.');
  const sessRef = sessSnap.docs[0].ref;
  const session = sessSnap.docs[0].data();
  const settings = (session.settings ?? {}) as Record<string, unknown>;

  if (session.status === 'finished') throw new HttpsError('failed-precondition', 'This game has ended.');
  if (session.status !== 'waiting') throw new HttpsError('failed-precondition', 'This game has already started.');
  if (settings.joinLocked === true) throw new HttpsError('permission-denied', 'Joining is locked.');
  const removedDoc = await sessRef.collection('removed').doc(uid).get();
  if (removedDoc.exists) throw new HttpsError('permission-denied', 'You were removed from this game.');

  const playerRef = sessRef.collection('players').doc(uid);
  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.data();
  if (!user) throw new HttpsError('failed-precondition', 'Profile missing. Try logging out and in again.');

  const now = new Date().toISOString();
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) {
    // Assign team for team battle mode.
    let teamId: string | undefined;
    if (session.gameMode === 'team') {
      const count = (await sessRef.collection('players').get()).size;
      teamId = ['blue', 'red', 'green', 'yellow'][count % ((settings.teamCount as number) ?? 3)];
    }
    await playerRef.set({
      uid,
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      avatarId: user.avatarId ?? 'a1',
      score: 0,
      xpEarned: 0,
      correctAnswers: 0,
      questionsAnswered: 0,
      streak: 0,
      eliminated: false,
      lives: session.gameMode === 'survival' || session.gameMode === 'battle' ? PLAYER_DEFAULT_HP : null,
      position: session.gameMode === 'race' ? 0 : null,
      coins: session.gameMode === 'treasure' ? 0 : null,
      locationsUnlocked: session.gameMode === 'treasure' ? 0 : null,
      teamId: teamId ?? null,
      currentGameState: 'waiting',
      joinedAt: now,
      lastActiveAt: now,
    });
  }

  return { ok: true, sessionId: sessRef.id };
});

// ============================
// startGame (teacher)
// ============================
export const startGame = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');

  const ref = db.collection('gameSessions').doc(sessionId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Game not found.');
    const s = snap.data()!;
    if (s.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can start the game.');
    if (s.status !== 'waiting') throw new HttpsError('failed-precondition', 'Game already started.');
    tx.update(ref, {
      status: 'countdown',
      startedAt: new Date().toISOString(),
      currentQuestionIndex: 0,
    });
  });

  // After a 3-second countdown, open question 1.
  setTimeout(() => void openQuestion(sessionId, 0), 3000);
  return { ok: true };
});

// ============================
// Question flow (teacher pacing + timing)
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
  if (!snap.exists) throw new HttpsError('not-found', 'Game not found.');
  const s = snap.data()!;
  if (s.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can advance.');
  if (!['question_active', 'question_results', 'countdown'].includes(s.status)) {
    throw new HttpsError('failed-precondition', 'Cannot advance from current state.');
  }
  // From the lobby countdown, advanceQuestion opens question 1 (index 0).
  const nextIndex = s.status === 'countdown' ? 0 : (s.currentQuestionIndex ?? 0) + 1;
  await openQuestion(sessionId, nextIndex);
  return { ok: true };
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
  if (!sessSnap.exists) throw new HttpsError('not-found', 'Game not found.');
  const session = sessSnap.data()!;
  if (session.status !== 'question_active') {
    throw new HttpsError('failed-precondition', 'Not currently accepting answers.');
  }

  const currentIndex = session.currentQuestionIndex ?? 0;

  // Validate question belongs to the active quiz & index.
  const quizRef = db.collection('quizzes').doc(session.quizId);
  const questionsSnap = await quizRef.collection('questions').orderBy('order', 'asc').get();
  const docs = questionsSnap.docs;
  if (currentIndex >= docs.length || docs[currentIndex].id !== questionId) {
    throw new HttpsError('failed-precondition', 'That question is not active.');
  }
  const questionDoc = docs[currentIndex];
  const q = questionDoc.data() as {
    correctOption: number; points?: number; timeLimit?: number; explanation?: string;
  };

  // Deadline check (server time is authoritative).
  const endsAtMs = session.questionEndsAt ? new Date(session.questionEndsAt).getTime() : 0;
  const nowMs = Date.now();
  if (nowMs > endsAtMs + 500) {
    throw new HttpsError('deadline-exceeded', 'Time is up for this question.');
  }

  const playerRef = sessRef.collection('players').doc(uid);
  const answerRef = sessRef.collection('answers').doc(`${uid}_${questionId}`); // dedupe by ID
  const userRef = db.collection('users').doc(uid);

  // Battle mode: pick the opponent target BEFORE the transaction (weakest first);
  // the transaction re-reads the target via tx.get so the HP write is safe.
  let battleTargetRef: FirebaseFirestore.DocumentReference | null = null;
  if (session.gameMode === 'battle') {
    const allPlayersSnap = await sessRef.collection('players').get();
    const others = allPlayersSnap.docs
      .filter((d) => d.id !== uid && d.data().eliminated !== true)
      .map((d) => ({ ref: d.ref, score: (d.data().score as number) ?? 0, lives: (d.data().lives as number) ?? PLAYER_DEFAULT_HP }));
    if (others.length > 0) {
      // Target the HP-sorted weakest opponent, with small random tie-breaking.
      others.sort((a, b) => a.lives - b.lives || a.score - b.score || Math.random() - 0.5);
      battleTargetRef = others[0].ref;
    }
  }

  const result = await db.runTransaction(async (tx) => {
    const [playerSnap, existingAnswer, userSnap] = await Promise.all([
      tx.get(playerRef), tx.get(answerRef), tx.get(userRef),
    ]);
    if (!playerSnap.exists) throw new HttpsError('permission-denied', 'You are not in this game.');
    if (existingAnswer.exists) throw new HttpsError('already-exists', 'You already answered this question.');
    const player = playerSnap.data()!;
    if (player.eliminated === true) throw new HttpsError('failed-precondition', 'You have been eliminated.');

    const user = userSnap.data() ?? {};
    const settings = (session.settings ?? {}) as Record<string, unknown>;
    const isCorrect = selectedOption === q.correctOption;
    const questionTimeLimit = Math.max(5, Math.min(120, q.timeLimit ?? 20));
    const startedAtMs = session.questionStartedAt ? new Date(session.questionStartedAt).getTime() : nowMs;
    const responseTime = Math.max(0, Math.min(nowMs - startedAtMs, questionTimeLimit * 1000)) / 1000;

    // ---- Scoring (server-only) ----
    const basePoints = (q.points as number) ?? GAME_REWARD_CONFIG.basePointsPerQuestion;
    const speedBonusEnabled = settings.speedBonus !== false;
    const speedFrac = Math.max(0, 1 - responseTime / questionTimeLimit);
    const speedBonus = speedBonusEnabled ? Math.round(speedFrac * GAME_REWARD_CONFIG.maxSpeedBonusPoints) : 0;
    const pointsEarned = isCorrect ? basePoints + speedBonus : 0;

    // Streak (server-managed)
    const streak = isCorrect ? (player.streak ?? 0) + 1 : 0;

    // XP
    let xpEarned = 0;
    if (isCorrect) {
      xpEarned += GAME_REWARD_CONFIG.correctAnswerXP;
      if (responseTime * 1000 <= GAME_REWARD_CONFIG.fastAnswerThresholdMs) xpEarned += GAME_REWARD_CONFIG.fastAnswerXP;
      if (streak > 2) xpEarned += Math.min(GAME_REWARD_CONFIG.streakBonusMax, GAME_REWARD_CONFIG.streakBonusXP * Math.min(streak - 2, 4));
    }

    // ---- Game-mode effects ----
    const updates: Record<string, unknown> = {
      score: FieldValue.increment(pointsEarned),
      xpEarned: FieldValue.increment(xpEarned),
      correctAnswers: FieldValue.increment(isCorrect ? 1 : 0),
      questionsAnswered: FieldValue.increment(1),
      streak,
      currentGameState: 'answered',
      lastActiveAt: new Date().toISOString(),
    };

    const modeEvent: Record<string, unknown> = {};
    if (isCorrect) {
      switch (session.gameMode) {
        case 'race': {
          const step = GAME_REWARD_CONFIG.raceStepPerCorrect + (speedFrac * GAME_REWARD_CONFIG.raceSpeedBonusStep);
          updates.position = FieldValue.increment(Math.min(1 - (player.position ?? 0), step));
          break;
        }
        case 'battle': {
          // A correct answer is an attack: the targeted opponent loses HP.
          const damage = GAME_REWARD_CONFIG.battleDamagePerCorrect + (speedFrac > 0.5 ? GAME_REWARD_CONFIG.battleSpeedBonusDamage : 0);
          modeEvent.damage = damage;
          if (battleTargetRef) {
            const targetSnap = await tx.get(battleTargetRef);
            if (targetSnap.exists) {
              const targetLives = (targetSnap.data()!.lives as number) ?? PLAYER_DEFAULT_HP;
              const newLives = Math.max(0, targetLives - damage);
              tx.update(battleTargetRef, { lives: newLives, eliminated: newLives <= 0 });
              modeEvent.target = battleTargetRef.id;
              modeEvent.defeated = newLives <= 0;
            }
          }
          break;
        }
        case 'treasure': {
          updates.coins = FieldValue.increment(GAME_REWARD_CONFIG.treasureCoinPerCorrect);
          const locs = Math.min(8, Math.floor(((player.coins ?? 0) + GAME_REWARD_CONFIG.treasureCoinPerCorrect) / GAME_REWARD_CONFIG.treasureCoinPerCorrect));
          updates.locationsUnlocked = locs;
          break;
        }
        default:
          break;
      }
    }
    if (session.gameMode === 'survival' && !isCorrect) {
      const lives = (player.lives ?? PLAYER_DEFAULT_HP) - 1;
      updates.lives = Math.max(0, lives);
      if (lives <= 0) updates.eliminated = true;
    }

    const answerData = {
      uid,
      questionId,
      questionIndex: currentIndex,
      selectedOption,
      answeredAt: new Date().toISOString(),
      responseTime,
      isCorrect,
      pointsEarned,
      xpEarned,
      streakAfter: streak,
      modeEvent,
    };

    tx.set(answerRef, answerData);
    tx.update(playerRef, updates);

    return { isCorrect, pointsEarned, xpEarned, streak, reveal: { correctOption: q.correctOption, explanation: (q as { explanation?: string }).explanation ?? '' } };
  });

  // Permanent XP on the user profile (outside session tx to reduce contention).
  if (result.xpEarned > 0) {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return;
      const u = userSnap.data()!;
      const newXp = (u.xp ?? 0) + result.xpEarned;
      tx.update(userRef, {
        xp: newXp,
        level: levelForXP(newXp),
        totalCorrect: FieldValue.increment(result.isCorrect ? 1 : 0),
        totalQuestions: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });
    });
  }

  // Boss damage side-effect
  if (session.gameMode === 'boss' && result.isCorrect) {
    await applyBossDamage(sessRef, session, GAME_REWARD_CONFIG.battleDamagePerCorrect);
  }

  return { ok: true, ...result, reveal: { correctOption: q.correctOption, explanation: q.explanation ?? '' } };
});

async function applyBossDamage(
  sessRef: FirebaseFirestore.DocumentReference,
  session: FirebaseFirestore.DocumentData,
  damage: number
) {
  const settings = (session.settings ?? {}) as Record<string, unknown>;
  const maxHp = (settings.bossHp as number) || 100;
  let defeatedNow = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessRef);
    if (!snap.exists) return;
    const s = snap.data()!;
    if (s.status === 'finished' || s.bossDefeated === true) return;
    const current = (s.bossDamage as number) ?? 0;
    const next = Math.min(maxHp, current + damage);
    if (next >= maxHp) {
      tx.update(sessRef, { bossDamage: next, bossDefeated: true });
      defeatedNow = true;
    } else {
      tx.update(sessRef, { bossDamage: next });
    }
  });
  if (defeatedNow) {
    // Outside the tx: finish once (finishSession re-checks state atomically).
    const fresh = await sessRef.get();
    if (fresh.exists) await finishSession(sessRef, fresh.data()!);
  }
}

// ============================
// finishGame (teacher)
// ============================
export const finishGame = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');

  const sessRef = db.collection('gameSessions').doc(sessionId);
  const snap = await sessRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Game not found.');
  const s = snap.data()!;
  if (s.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can finish the game.');
  if (s.status === 'finished') return { ok: true };

  await finishSession(sessRef, s);
  return { ok: true };
});

async function finishSession(sessRef: FirebaseFirestore.DocumentReference, s: FirebaseFirestore.DocumentData) {
  const sessionId = sessRef.id;
  const settings = (s.settings ?? {}) as Record<string, unknown>;

  // Atomically claim the finish so concurrent paths (teacher end, boss defeat,
  // last question auto-finish) award players exactly once.
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessRef);
    if (!snap.exists) return false;
    const cur = snap.data()!;
    if (cur.status === 'finished') return false;
    tx.update(sessRef, { status: 'finished', endedAt: new Date().toISOString() });
    return true;
  });
  if (!claim) return;

  // Determine winner(s)
  const playersSnap = await sessRef.collection('players').get();
  const players = playersSnap.docs.map((d) => d.data() as Record<string, unknown>);

  let winnerUids: string[] = [];
  if (s.gameMode === 'team') {
    const teamScores: Record<string, number> = {};
    players.forEach((p) => {
      const t = (p.teamId as string) || 'none';
      teamScores[t] = (teamScores[t] ?? 0) + ((p.score as number) ?? 0);
    });
    const best = Math.max(...Object.values(teamScores), 0);
    winnerUids = players.filter((p) => teamScores[(p.teamId as string) || 'none'] === best).map((p) => p.uid as string);
  } else if (s.gameMode === 'survival') {
    const survivors = players.filter((p) => p.eliminated !== true);
    const bestScore = Math.max(...survivors.map((p) => (p.score as number) ?? 0), 0);
    winnerUids = (survivors.length > 0 ? survivors : players)
      .filter((p) => (p.score as number) === bestScore)
      .map((p) => p.uid as string);
  } else if (s.gameMode === 'race') {
    // Race: whoever progressed furthest along the track wins; score only breaks ties.
    const bestPos = Math.max(...players.map((p) => (p.position as number) ?? 0), 0);
    const leaders = players.filter((p) => (p.position as number) === bestPos);
    const bestScore = Math.max(...leaders.map((p) => (p.score as number) ?? 0), 0);
    winnerUids = leaders.filter((p) => (p.score as number) === bestScore).map((p) => p.uid as string);
  } else if (s.gameMode === 'battle') {
    // Battle: last players standing win; among the living, score breaks ties.
    const alive = players.filter((p) => p.eliminated !== true);
    const pool = alive.length > 0 ? alive : players;
    const bestScore = Math.max(...pool.map((p) => (p.score as number) ?? 0), 0);
    winnerUids = pool.filter((p) => (p.score as number) === bestScore).map((p) => p.uid as string);
  } else {
    const bestScore = Math.max(...players.map((p) => (p.score as number) ?? 0), 0);
    winnerUids = players.filter((p) => (p.score as number) === bestScore).map((p) => p.uid as string);
  }

  // Rank players by mode-appropriate metric.
  const metric = (p: Record<string, unknown>): number =>
    s.gameMode === 'race' ? ((p.position as number) ?? 0) * 1e9 + ((p.score as number) ?? 0) : ((p.score as number) ?? 0);
  const ranked = [...players].sort((a, b) => metric(b) - metric(a));

  const batch = db.batch();
  ranked.forEach((p, i) => {
    const uid = p.uid as string;
    const gameResultRef = db.collection('gameResults').doc(`${sessionId}_${uid}`);
    batch.set(gameResultRef, {
      sessionId,
      quizId: s.quizId,
      gameMode: s.gameMode,
      teacherId: s.teacherId,
      uid,
      displayName: p.displayName,
      avatarId: p.avatarId ?? null,
      rank: i + 1,
      score: p.score ?? 0,
      correctAnswers: p.correctAnswers ?? 0,
      questionsAnswered: p.questionsAnswered ?? 0,
      accuracy: (p.questionsAnswered as number) > 0 ? (p.correctAnswers as number) / (p.questionsAnswered as number) : 0,
      xpEarned: p.xpEarned ?? 0,
      won: winnerUids.includes(uid),
      streak: p.streak ?? 0,
      createdAt: new Date().toISOString(),
    });
  });
  await batch.commit();

  // Award completion XP, wins, gamesPlayed, streak-day tracking, achievements.
  for (const p of players) {
    const uid = p.uid as string;
    const completionXP = GAME_REWARD_CONFIG.gameCompletionXP + (winnerUids.includes(uid) ? GAME_REWARD_CONFIG.winXP : 0);
    const userRef = db.collection('users').doc(uid);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return;
      const u = userSnap.data()!;
      const xp = (u.xp ?? 0) + completionXP;
      const gamesPlayed = (u.gamesPlayed ?? 0) + 1;
      const gamesWon = (u.gamesWon ?? 0) + (winnerUids.includes(uid) ? 1 : 0);

      // Day-based play streak
      const today = new Date().toISOString().slice(0, 10);
      const last = (u.lastPlayedAt as string | undefined)?.slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let currentStreak = u.currentStreak ?? 0;
      if (last === today) {
        // already counted today
      } else if (last === yesterday) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
      const longestStreak = Math.max(u.longestStreak ?? 0, currentStreak);

      tx.update(userRef, {
        xp,
        level: levelForXP(xp),
        gamesPlayed,
        gamesWon,
        currentStreak,
        longestStreak,
        lastPlayedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Achievements
      const achRef = (id: string) => db.collection('userAchievements').doc(uid).collection('items').doc(id);
      const now = new Date().toISOString();
      const unlock = (id: string) => tx.set(achRef(id), { achievementId: id, unlockedAt: now }, { merge: true });

      if (gamesPlayed >= 1) unlock('first_game');
      if (gamesWon >= 1) unlock('champion');
      if (xp >= 100) unlock('century');
      if (levelForXP(xp) >= 10) unlock('legend');
      if (s.gameMode === 'survival' && winnerUids.includes(uid)) unlock('survivor');
      if (s.gameMode === 'boss' && (s.bossDefeated === true)) unlock('boss_slayer');

      const totalQ = (p.questionsAnswered as number) ?? 0;
      const totalC = (p.correctAnswers as number) ?? 0;
      if (totalQ > 0 && totalC === totalQ) unlock('perfect');
      if ((p.streak as number) >= 10) unlock('on_fire');
    });

    // Record earned XP in the session result doc (approximate total = earned + completion bonus)
    const totalXp = ((p.xpEarned as number) ?? 0) + completionXP;
    await db.collection('gameResults').doc(`${sessionId}_${uid}`).update({
      xpEarned: totalXp,
      achievementsUnlocked: FieldValue.arrayUnion('game_complete'),
    }).catch(() => {});
  }

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
  if (!snap.exists) throw new HttpsError('not-found', 'Game not found.');
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
  if (!snap.exists) throw new HttpsError('not-found', 'Game not found.');
  if (snap.data()!.teacherId !== uid) throw new HttpsError('permission-denied', 'Only the host can lock joining.');

  await sessRef.update({ 'settings.joinLocked': locked });
  return { ok: true };
});

export const leaveGame = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sessionId } = (request.data ?? {}) as { sessionId?: string };
  if (!sessionId) throw new HttpsError('invalid-argument', 'Missing sessionId.');
  await db.collection('gameSessions').doc(sessionId).collection('players').doc(uid).delete();
  return { ok: true };
});
