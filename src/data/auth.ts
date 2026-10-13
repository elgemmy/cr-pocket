/**
 * Authentication store. Two modes:
 * - `firebase`: Google sign-in via Firebase Auth (popup, with redirect fallback).
 * - `demo`: no Firebase config — a local fake user persisted in localStorage so the
 *   whole app is usable with zero setup.
 *
 * Call `initAuth()` once at app startup (before/at render).
 */
import { create } from 'zustand';
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { appMode } from '@/config';
import { authPersistenceReady, getFirebaseAuth } from './firebase';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type AuthMode = 'firebase' | 'demo';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  mode: AuthMode;
  /** Human-readable sign-in error, cleared on the next attempt. */
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const DEMO_AUTH_KEY = 'crpocket:demo:auth';
const DEMO_USER: AuthUser = {
  uid: 'demo-user',
  displayName: 'Demo Player',
  email: 'demo@crpocket.local',
  photoURL: null,
};

function loadDemoUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(DEMO_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    return typeof parsed.uid === 'string' ? (parsed as AuthUser) : null;
  } catch {
    return null;
  }
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function readableAuthError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/network-request-failed':
      return 'Network error during sign-in. Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in the Firebase project (Authentication → Settings → Authorized domains).';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in the Firebase project.';
    default:
      return `Sign-in failed${code ? ` (${code})` : ''}.`;
  }
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

export const useAuth = create<AuthState>()((set, get) => ({
  status: 'loading',
  user: null,
  mode: appMode,
  error: null,

  async signInWithGoogle() {
    set({ error: null });
    if (get().mode === 'demo') {
      try {
        localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(DEMO_USER));
      } catch {
        // storage unavailable (private mode): keep the session in memory only.
      }
      set({ status: 'signedIn', user: DEMO_USER });
      return;
    }
    try {
      await authPersistenceReady();
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      // Popups are unreliable inside an installed PWA; go straight to redirect.
      if (isStandalonePwa()) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
      // onAuthStateChanged updates the store.
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return; // user cancelled; not an error
      }
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported'
      ) {
        try {
          await signInWithRedirect(getFirebaseAuth(), new GoogleAuthProvider());
          return;
        } catch (redirectErr) {
          set({ error: readableAuthError(redirectErr) });
          return;
        }
      }
      set({ error: readableAuthError(err) });
    }
  },

  async signOut() {
    if (get().mode === 'demo') {
      try {
        localStorage.removeItem(DEMO_AUTH_KEY);
      } catch {
        // ignore
      }
      set({ status: 'signedOut', user: null, error: null });
      return;
    }
    try {
      await firebaseSignOut(getFirebaseAuth());
      // onAuthStateChanged updates the store; the library store reacts to it.
    } catch (err) {
      set({ error: readableAuthError(err) });
    }
  },
}));

let initialized = false;

/** Wire up the auth listener (or restore the demo session). Call once at startup. */
export function initAuth(): void {
  if (initialized) return;
  initialized = true;

  if (appMode === 'demo') {
    const user = loadDemoUser();
    useAuth.setState(
      user ? { status: 'signedIn', user, error: null } : { status: 'signedOut', user: null },
    );
    return;
  }

  const auth = getFirebaseAuth();
  // Complete a pending redirect sign-in (popup fallback / standalone PWA).
  getRedirectResult(auth).catch((err) => {
    useAuth.setState({ error: readableAuthError(err) });
  });
  onAuthStateChanged(auth, (user) => {
    useAuth.setState(
      user
        ? { status: 'signedIn', user: toAuthUser(user), error: null }
        : { status: 'signedOut', user: null },
    );
  });
}
