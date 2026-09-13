// MINED — Auth context: holds Firebase auth state + Firestore profile/role.
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, firebaseConfigured } from '../lib/firebase';
import type { UserProfile } from '../lib/types';

export type ProfileError = 'denied' | 'timeout' | 'error' | null;

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: ProfileError;
  role: 'teacher' | 'student' | null;
  login: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface RegisterData {
  role: 'teacher' | 'student';
  displayName: string;
  email: string;
  password: string;
  avatarId?: string;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Rejects if the Firestore op takes longer than `ms` — prevents infinite spinners. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function defaultProfile(user: User): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: user.uid,
    role: 'student', // Google sign-ins default to student
    displayName: user.displayName || 'Player',
    email: user.email ?? '',
    photoURL: null,
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
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<ProfileError>(null);

  /**
   * Load the user's profile; if it doesn't exist yet (first Google sign-in),
   * create a default student profile. Never throws — failures are reported
   * through `profileError` so the UI can show actionable guidance instead of
   * hanging on a spinner.
   */
  const ensureProfile = useCallback(async (u: User) => {
    const ref = doc(db, 'users', u.uid);
    try {
      const snap = await withTimeout(getDoc(ref), 10000);
      if (snap.exists()) {
        setProfile({ ...(snap.data() as UserProfile) });
        setProfileError(null);
        return;
      }
      // Missing profile (e.g. first Google sign-in) → create default student.
      const data = defaultProfile(u);
      await withTimeout(setDoc(ref, data), 10000);
      setProfile(data);
      setProfileError(null);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      const msg = (e as Error)?.message ?? '';
      setProfile(null);
      if (code.includes('permission-denied')) setProfileError('denied');
      else if (msg === 'timeout') setProfileError('timeout');
      else setProfileError('error');
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        ensureProfile(u).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
      }
    });
    return unsub;
  }, [ensureProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureProfile(cred.user);
  }, [ensureProfile]);

  const loginGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    // Provision/read profile before resolving so post-login navigation works.
    await ensureProfile(cred.user);
  }, [ensureProfile]);

  const register = useCallback(async (data: RegisterData) => {
    if (!firebaseConfigured) throw new Error('Firebase is not configured. Copy .env.example to .env and fill in your Firebase web config.');
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = cred.user.uid;

    const now = new Date().toISOString();
    const userProfile: UserProfile = {
      uid,
      role: data.role,
      displayName: data.displayName,
      email: data.email,
      photoURL: null,
      avatarId: data.avatarId ?? 'a1',
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
    };
    await setDoc(doc(db, 'users', uid), userProfile);
    setProfile(userProfile);
    setProfileError(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
    setProfileError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await ensureProfile(user);
  }, [user, ensureProfile]);

  // Keep profile fresh when the underlying user doc changes (XP updates mid-session).
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) setProfile({ ...(snap.data() as UserProfile) });
      },
      () => {
        /* permission/network errors: keep last known profile */
      }
    );
    return unsub;
  }, [user]);

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        loading,
        profileError,
        role: profile?.role ?? null,
        login,
        loginGoogle,
        register,
        resetPassword,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
