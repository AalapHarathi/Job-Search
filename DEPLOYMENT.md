# Deployment

## Before you start: public or private repo?

GitHub Pages on a **free** GitHub account only publishes from **public** repositories (private-repo Pages needs GitHub Pro or higher). A public repo is safe here: it contains code only — no keys, no resume, no application data. Your data lives in Firestore behind sign-in. If you'd rather keep the code private, use GitHub Pro, or deploy `dist/` to Firebase Hosting instead.

## 1. Create the repository and push

```bash
cd career-intel
git init
git add .
git commit -m "Career Intel"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/career-intel.git
git push -u origin main
```

(Or create the repo on github.com and upload the files.) The site URL will be `https://YOUR-USERNAME.github.io/career-intel/`. The build sets the base path from the repo name automatically.

## 2. Add GitHub Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

### Required

| Secret | Where it comes from |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web config (FIREBASE_SETUP.md §1) |
| `VITE_FIREBASE_AUTH_DOMAIN` | 〃 |
| `VITE_FIREBASE_PROJECT_ID` | 〃 |
| `VITE_FIREBASE_APP_ID` | 〃 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 〃 |
| `FIREBASE_SERVICE_ACCOUNT` | Whole service-account JSON (FIREBASE_SETUP.md §5) |
| `OWNER_UIDS` | Your Firebase Auth UID (FIREBASE_SETUP.md §6) — add after first sign-in |

### Job sources

Greenhouse, Lever and Ashby boards need **no key**. The job APIs are optional but recommended:

| Secret | Service | Cost |
|---|---|---|
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Register at <https://developer.adzuna.com> | Free developer access with rate limits — check their current terms |
| `REED_API_KEY` | Register at <https://www.reed.co.uk/developers/jobseeker> | Free |

Not used: LinkedIn/Indeed/Glassdoor (no permitted public API), JSearch/RapidAPI and similar (paid tiers). The app doesn't assume any paid service.

### Optional: AI analysis

| Name | Type | Value |
|---|---|---|
| `LLM_API_KEY` | Secret | Anthropic or OpenAI-compatible API key |
| `LLM_PROVIDER` | Variable | `anthropic` (default) or `openai` |
| `LLM_MODEL` | Variable | e.g. `claude-haiku-5-5` (default for Anthropic) |
| `LLM_BASE_URL` | Variable | Only for OpenAI-compatible providers |
| `LLM_MAX_JOBS_PER_RUN` | Variable | Default 20 — caps daily spend |

This is pay-as-you-go with the provider; check their current pricing. Without it, everything still works: scores and analysis come from the rules engine.

### Optional: email digest

| Name | Type | Value |
|---|---|---|
| `SMTP_URL` | Secret | e.g. `smtps://you%40gmail.com:APP-PASSWORD@smtp.gmail.com:465` (Gmail needs 2-step verification and an [app password](https://myaccount.google.com/apppasswords)) |
| `NOTIFY_EMAIL` | Secret | Where to send it |
| `DASHBOARD_URL` | Variable | Your Pages URL, included as a link |

One email per refresh, only when new notifications were created.

## 3. Enable GitHub Pages

Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Then **Actions → Deploy dashboard → Run workflow** (it also runs on every push to `main`). It runs the engine self-test, builds, and publishes. The URL appears in the workflow summary.

## 4. First run

1. Open the site, create your account (or continue with Google).
2. Copy your UID into the `OWNER_UIDS` secret.
3. **Resume intelligence** → upload your resume → check *Extracted information*.
4. **Search preferences** → review and **Save preferences**. Add employer boards you care about.
5. **Actions → Refresh jobs → Run workflow.** When it finishes (usually a few minutes), vacancies appear.

## Schedule

`refresh-jobs.yml` runs:

- **Daily at 02:30 UTC (08:00 IST)** — full discovery, verification of everything stored, scoring, notifications.
- **Every 3 hours** — a quick check that only does work if you pressed *Refresh jobs* in the dashboard.
- **Manually** — *Run workflow* on GitHub (linked from the dashboard as *Run now on GitHub*).

Actions minutes: free and unlimited on public repos; on private repos expect roughly 300–500 minutes a month, within the 2,000 free minutes. GitHub pauses scheduled workflows after 60 days with no repository activity — re-enable them from the Actions tab if that happens.

## Checking it works

```bash
npm run refresh:dry                          # starter boards
npm run refresh:dry -- greenhouse:monzo ashby:acme
ADZUNA_APP_ID=… ADZUNA_APP_KEY=… npm run refresh:dry
```

Each board prints ✓ with counts or ✗ with the reason (e.g. "Board not found" means the identifier is wrong). Board problems also appear in *Search preferences* after a run.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Connect Firebase to finish setup" on the live site | A `VITE_FIREBASE_*` secret is missing; add it and re-run *Deploy dashboard*. |
| Google sign-in: "domain isn't authorised" | Add `YOUR-USERNAME.github.io` to Firebase Auth → Authorized domains. |
| "Firestore denied access" | Publish `firestore.rules`. |
| Blank page or 404 for assets | Pages source must be *GitHub Actions*; don't rename the repo without redeploying. |
| Refresh workflow: "FIREBASE_SERVICE_ACCOUNT is not valid JSON" | Paste the entire key file, including the braces. |
| Refresh succeeds but the dashboard is empty | `OWNER_UIDS` doesn't match your UID, or no preferences saved / boards return no analyst roles. Check the run log. |
| Last refresh shows "failed" | The dashboard shows the error and keeps your last good data. Open the workflow run for details. |
