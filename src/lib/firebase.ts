import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { firebaseConfig, firebaseConfigured } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Firestore is the source of truth; the local cache only speeds up reloads.
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
}

export function getDb(): Firestore {
  if (!db) throw new Error('Firebase is not configured');
  return db;
}
export function getAuthClient(): Auth {
  if (!auth) throw new Error('Firebase is not configured');
  return auth;
}
