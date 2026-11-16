import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from 'firebase/auth';
import { getAuthClient } from '@/lib/firebase';
import { ensureUserDoc } from '@/lib/db';

interface AuthState {
  user: User | null;
  loading: boolean;
  signInEmail: (e: string, p: string) => Promise<void>;
  signUpEmail: (e: string, p: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(getAuthClient(), async (u) => {
    if (u) { try { await ensureUserDoc(u); } catch (e) { console.error(e); } }
    setUser(u);
    setLoading(false);
  }), []);
  const auth = getAuthClient();
  const value: AuthState = {
    user, loading,
    signInEmail: async (e, p) => { await signInWithEmailAndPassword(auth, e, p); },
    signUpEmail: async (e, p) => { await createUserWithEmailAndPassword(auth, e, p); },
    signInGoogle: async () => { await signInWithPopup(auth, new GoogleAuthProvider()); },
    resetPassword: async (e) => { await sendPasswordResetEmail(auth, e); },
    logout: async () => { await signOut(auth); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account uses this email.',
    'auth/email-already-in-use': 'An account already uses this email. Sign in instead.',
    'auth/weak-password': 'Use at least 8 characters for your password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
    'auth/unauthorized-domain': 'This domain isn’t authorised in Firebase. Add it under Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'This sign-in method is disabled. Enable it in Firebase → Authentication → Sign-in method.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/admin-restricted-operation': 'New sign-ups are disabled for this dashboard.',
  };
  return map[code] ?? (e as Error)?.message ?? 'Something went wrong.';
}
