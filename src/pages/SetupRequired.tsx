import { missingFirebaseKeys } from '@/lib/config';

export function SetupRequired() {
  return (
    <div className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full panel p-8">
        <h1 className="h-page">Connect Firebase to finish setup</h1>
        <p className="text-sm text-muted mt-2">The dashboard needs your Firebase project to sign you in and store your data. These build-time variables are missing:</p>
        <ul className="mt-4 space-y-1.5">{missingFirebaseKeys.map((k) => <li key={k}><code className="text-[0.8125rem] px-1.5 py-0.5 rounded bg-raised border border-line">{k}</code></li>)}</ul>
        <ol className="mt-6 space-y-3 text-sm list-decimal pl-5 marker:text-muted">
          <li>Create a Firebase project and a Web app (Project settings → General → Your apps).</li>
          <li>Locally: copy <code>.env.example</code> to <code>.env</code> and paste the values. On GitHub: add them as repository secrets with the same names.</li>
          <li>Enable Email/Password and Google sign-in, create Firestore, and deploy <code>firestore.rules</code>.</li>
          <li>Rebuild — locally restart <code>npm run dev</code>; on GitHub re-run the Deploy workflow.</li>
        </ol>
        <p className="text-sm text-muted mt-6">Full walkthrough: <b className="text-ink font-medium">FIREBASE_SETUP.md</b> in the repository.</p>
      </div>
    </div>
  );
}
