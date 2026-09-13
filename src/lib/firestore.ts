// MINED — Firestore data-access helpers.
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Question, Quiz, UserProfile } from './types';

// ---------- Users ----------

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ ...(snap.data() as UserProfile) }) : null;
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', uid), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// ---------- Quizzes ----------

export async function createQuiz(ownerId: string, data: Partial<Quiz>): Promise<string> {
  const ref = await addDoc(collection(db, 'quizzes'), {
    ownerId,
    title: data.title ?? 'Untitled Quiz',
    description: data.description ?? '',
    subject: data.subject ?? '',
    difficulty: data.difficulty ?? 'easy',
    coverImage: null,
    published: false,
    questionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function updateQuiz(quizId: string, updates: Partial<Quiz>) {
  await updateDoc(doc(db, 'quizzes', quizId), { ...updates, updatedAt: new Date().toISOString() });
}

export async function deleteQuiz(quizId: string) {
  const qs = await getDocs(collection(db, 'quizzes', quizId, 'questions'));
  const batch = writeBatch(db);
  qs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'quizzes', quizId));
  await batch.commit();
}

export async function duplicateQuiz(quiz: Quiz): Promise<string> {
  const ref = await addDoc(collection(db, 'quizzes'), {
    ...quiz,
    id: undefined,
    title: `${quiz.title} (Copy)`,
    published: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const qs = await getDocs(collection(db, 'quizzes', quiz.id, 'questions'));
  const batch = writeBatch(db);
  qs.forEach((d) => {
    batch.set(doc(collection(db, 'quizzes', ref.id, 'questions')), d.data());
  });
  await batch.commit();
  return ref.id;
}

export async function getQuiz(quizId: string): Promise<Quiz | null> {
  const snap = await getDoc(doc(db, 'quizzes', quizId));
  return snap.exists() ? (snap.data() as Quiz) : null;
}

export function subscribeTeacherQuizzes(ownerId: string, cb: (quizzes: Quiz[]) => void): Unsubscribe {
  const q = query(collection(db, 'quizzes'), where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Quiz), id: d.id }))));
}

// ---------- Questions ----------

export async function addQuestion(quizId: string, data: Partial<Question>): Promise<string> {
  const ref = await addDoc(collection(db, 'quizzes', quizId, 'questions'), {
    question: data.question ?? '',
    options: data.options ?? ['', '', '', ''],
    correctOption: data.correctOption ?? 0,
    explanation: data.explanation ?? '',
    timeLimit: data.timeLimit ?? 20,
    points: data.points ?? 100,
    order: data.order ?? Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await updateQuiz(quizId, {});
  await recomputeQuestionCount(quizId);
  return ref.id;
}

export async function updateQuestion(quizId: string, questionId: string, updates: Partial<Question>) {
  await updateDoc(doc(db, 'quizzes', quizId, 'questions', questionId), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteQuestion(quizId: string, questionId: string) {
  await deleteDoc(doc(db, 'quizzes', quizId, 'questions', questionId));
  await recomputeQuestionCount(quizId);
}

export async function duplicateQuestion(quizId: string, question: Question) {
  return addQuestion(quizId, { ...question, id: undefined, question: `${question.question} (copy)` });
}

export async function reorderQuestion(quizId: string, questionId: string, newOrder: number) {
  await updateDoc(doc(db, 'quizzes', quizId, 'questions', questionId), { order: newOrder });
}

export function subscribeQuestions(quizId: string, cb: (questions: Question[]) => void): Unsubscribe {
  const q = query(collection(db, 'quizzes', quizId, 'questions'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Question), id: d.id }))));
}

async function recomputeQuestionCount(quizId: string) {
  const qs = await getDocs(collection(db, 'quizzes', quizId, 'questions'));
  await updateDoc(doc(db, 'quizzes', quizId), {
    questionCount: qs.size,
    updatedAt: new Date().toISOString(),
  });
}

export { serverTimestamp };
