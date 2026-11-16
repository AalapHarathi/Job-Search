import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function db() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set. Add the service-account JSON as a GitHub Actions secret.');
    let creds: Record<string, string>;
    try { creds = JSON.parse(raw); }
    catch { throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole key file contents.'); }
    initializeApp({ credential: cert(creds as never) });
  }
  const f = getFirestore();
  f.settings({ ignoreUndefinedProperties: true });
  return f;
}
