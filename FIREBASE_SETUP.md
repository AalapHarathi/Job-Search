# Firebase setup

Everything here works on the free **Spark** plan. Takes about 15 minutes.

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project**. Name it (e.g. `career-intel`). Google Analytics is not needed.
2. **Project settings** (gear icon) → **General** → *Your apps* → click the **`</>` Web** icon → register an app (no Firebase Hosting needed).
3. Copy the config values shown. You'll need:

| Firebase config field | Variable / GitHub secret |
|---|---|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |

These identify your project and are designed to be public; your data is protected by Authentication and the Security Rules below, not by hiding them.

## 2. Authentication

1. **Build → Authentication → Get started.**
2. **Sign-in method** → enable **Email/Password** and **Google** (pick a support email for Google).
3. **Settings → Authorized domains** → **Add domain** → `aalapharathi.github.io`. (`localhost` is there by default.) Without this, Google sign-in fails on the live site.
4. Password reset emails work automatically. You can edit their wording under **Templates**.

**Keep it private:** after you've created your own account, if your project shows **Settings → User actions → Enable create (sign-up)**, switch it off. Either way, every user's data is isolated by the rules, and the refresh workflow only runs when `OWNER_UIDS` is set and only processes those UIDs.

## Where each value goes

| Value | Local dev | Production |
|---|---|---|
| `VITE_FIREBASE_*` (5 values) | `.env` (copy of `.env.example`) | GitHub **Secrets** (DEPLOYMENT.md §2) |
| Service-account JSON | not needed for the app | GitHub Secret `FIREBASE_SERVICE_ACCOUNT` |
| Your UID | — | GitHub Secret `OWNER_UIDS` |

## 3. Cloud Firestore

1. **Build → Firestore Database → Create database.**
2. Choose a location close to you (e.g. `asia-south1` Mumbai). This can't be changed later.
3. Start in **production mode** (denies everything until you publish the rules below).

## 4. Deploy the Security Rules

The rules in `firestore.rules` ensure only you can read your data, stop the browser from creating fake vacancies or editing verification data, and validate every application, resume and preference write.

**Option A — console (no tools):** Firestore → **Rules** tab → replace everything with the contents of `firestore.rules` → **Publish**.

**Option B — CLI:**

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # put your project id in it
firebase deploy --only firestore:rules
```

If the dashboard shows "Firestore denied access", the rules haven't been published.

## 5. Service account for the refresh job

The scheduled job writes vacancies with the Admin SDK.

1. **Project settings → Service accounts → Generate new private key.** A JSON file downloads.
2. Open it, copy the **entire** contents, and save it as the GitHub secret `FIREBASE_SERVICE_ACCOUNT` (see DEPLOYMENT.md).
3. Delete the downloaded file afterwards. Never commit it — `.gitignore` blocks common key filenames, but don't rely on that.

If a service-account key is ever exposed (committed, pasted in chat, shared): Project settings → Service accounts → *Manage service account permissions* (Google Cloud console) → open the account → **Keys** → delete that key → generate a new one → update the `FIREBASE_SERVICE_ACCOUNT` secret. Deleting it from git history alone is not enough.

## 6. Your user ID

After you sign in to the dashboard for the first time: **Authentication → Users** → copy the **User UID** of your account → save as GitHub secret `OWNER_UIDS`.

## Data model

```
users/{uid}                         email, displayName, createdAt, lastLoginAt
users/{uid}/settings/preferences    countries, titles, boards, freshness + notification settings
users/{uid}/resumes/{versionId}     extracted text, parsed profile, optional AI profile, primary flag
users/{uid}/resumeFiles/{versionId} original file (base64, ≤700 KB) for re-download
users/{uid}/jobs/{jobId}            vacancy, sources, verification, sponsorship, match, status
users/{uid}/applications/{jobId}    application record + status history (one per vacancy)
users/{uid}/notifications/{id}      in-app notifications
users/{uid}/meta/refresh            last/next refresh, counts, per-source health, manual request flag
users/{uid}/refreshRuns/{runId}     history of refresh runs
```

`jobId` is a hash of company + normalised title + city + country, which is how the same vacancy from several sources merges into one record and why it can only be applied to once. Saved jobs are vacancies with status *Saved/Shortlisted/Ready to Apply*, so status lives in one place.

Resume files are stored in Firestore rather than Cloud Storage because new Storage buckets require the paid Blaze plan.
