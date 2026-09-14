// Mined — Firebase initialization. Credentials come from env vars only.
// If Firebase isn't configured yet (no .env), we initialize with placeholder
// values so the UI still renders; auth/data calls are gated behind
// `firebaseConfigured` and show friendly errors instead of crashing the app.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const env = import.meta.env as Record<string, string | undefined>;

// Accept both VITE_-prefixed (Vite convention) and unprefixed names, so the
// app works whether vars are named VITE_FIREBASE_API_KEY or FIREBASE_API_KEY.
function envVal(name: string): string | undefined {
  return env[`VITE_${name}`] || env[name];
}

export const firebaseConfigured = Boolean(envVal('FIREBASE_API_KEY') && envVal('FIREBASE_PROJECT_ID') && envVal('FIREBASE_APP_ID'));

// Placeholders keep SDK service constructors happy when env vars are absent.
// They never reach a real server — all data calls check firebaseConfigured first.
const firebaseConfig = {
  apiKey: envVal('FIREBASE_API_KEY') || 'demo-api-key',
  authDomain: envVal('FIREBASE_AUTH_DOMAIN') || 'demo.firebaseapp.com',
  projectId: envVal('FIREBASE_PROJECT_ID') || 'demo-project',
  messagingSenderId: envVal('FIREBASE_MESSAGING_SENDER_ID') || '0',
  appId: envVal('FIREBASE_APP_ID') || 'demo-app-id',
};

let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch {
  // Extremely defensive: never let Firebase init crash the whole UI.
  app = initializeApp({ ...firebaseConfig, apiKey: 'demo-api-key' }, 'mined-fallback');
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
