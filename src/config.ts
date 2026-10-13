const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** Firebase is used only when a full web config is present; otherwise the app runs in local demo mode. */
export const hasFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

/** Point the SDK at local emulators (`npm run emulators`). */
export const useEmulators = env.VITE_FIREBASE_EMULATORS === 'true';

/** `live` calls `/api/*` (Pages Functions). `demo` uses bundled sample game data. */
export const gameApiMode: 'live' | 'demo' = env.VITE_GAME_API === 'live' ? 'live' : 'demo';

export const appMode: 'firebase' | 'demo' = hasFirebase ? 'firebase' : 'demo';
