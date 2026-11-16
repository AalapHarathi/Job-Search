const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
};

export const missingFirebaseKeys = (Object.entries({
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
}) as [string, string][]).filter(([, v]) => !v).map(([k]) => k);

export const firebaseConfigured = missingFirebaseKeys.length === 0;

export const githubRepo = env.VITE_GITHUB_REPO ?? '';
export const refreshWorkflowUrl = githubRepo ? `https://github.com/${githubRepo}/actions/workflows/refresh-jobs.yml` : null;
