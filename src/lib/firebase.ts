// Mined — Firebase initialization. Credentials come from env vars only.
// If Firebase isn't configured yet (no .env), we initialize with placeholder
// values so the UI still renders; auth/data calls are gated behind
// `firebaseConfigured` and show friendly errors instead of crashing the app.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const env = import.meta.env;

export const firebaseConfigured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);

// Placeholders keep SDK service constructors happy when env vars are absent.
// They never reach a real server — all data calls check firebaseConfigured first.
const firebaseConfig = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string) || 'demo-api-key',
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string) || 'demo.firebaseapp.com',
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string) || 'demo-project',
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '0',
  appId: (env.VITE_FIREBASE_APP_ID as string) || 'demo-app-id',
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
