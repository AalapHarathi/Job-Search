# Troubleshooting

Live site: <https://aalapharathi.github.io/Job-Search/> · Workflows: <https://github.com/AalapHarathi/Job-Search/actions>

## Deployment

| Symptom | Cause | Fix |
|---|---|---|
| Blank white page; console shows 404 for `/src/main.tsx` | Pages is serving the raw repo instead of the build | Settings → Pages → *Source: **GitHub Actions*** (not "Deploy from a branch"), then re-run *Deploy dashboard*. |
| 404 for `/assets/…` files | Wrong base path | The workflow sets `VITE_BASE_PATH=/<repo-name>/`. If you rename the repo, push again to redeploy. |
| *Deploy dashboard* fails at `deploy-pages` with "Get Pages site failed" / 404 | Pages not enabled for Actions | Same fix as the first row. |
| *Deploy dashboard* fails at `deploy-pages`: "Branch main is not allowed to deploy to github-pages" | Environment protection rule | Settings → Environments → `github-pages` → Deployment branches → allow `main`. |
| Build step fails with TypeScript errors | Code error | Run `npm run build` locally; the same `tsc -b` runs in CI. |
| Workflow annotation "Firebase not configured" | `VITE_FIREBASE_*` secrets missing | Add them (FIREBASE_SETUP.md §1), then *Actions → Deploy dashboard → Run workflow*. Secrets are baked in at build time, so a redeploy is required after changing them. |

## Sign-in

| Symptom | Fix |
|---|---|
| "Connect Firebase to finish setup" | See the row above — secrets missing at build time. |
| Google sign-in: "domain isn't authorised" | Firebase → Authentication → Settings → Authorized domains → add `aalapharathi.github.io`. |
| "This sign-in method is disabled" | Firebase → Authentication → Sign-in method → enable Email/Password and Google. |
| Password-reset email not arriving | Check spam; the sender is `noreply@<project>.firebaseapp.com`. Edit under Authentication → Templates. |
| "New sign-ups are disabled" | Intended if you turned off sign-up in Firebase. Re-enable temporarily to add an account. |

## Data

| Symptom | Fix |
|---|---|
| "Firestore denied access" / permission-denied in console | Publish `firestore.rules` (FIREBASE_SETUP.md §4). |
| Dashboard empty after a refresh | `OWNER_UIDS` doesn't match your UID, no preferences saved yet, or your boards returned no matching titles. Open the run log. |
| "Last refresh failed" in the dashboard | Open the latest *Refresh jobs* run; the error is also shown in the dashboard. Previous data is kept. |

## Refresh job

| Log message | Fix |
|---|---|
| `Refresh skipped` (scheduled run) | `FIREBASE_SERVICE_ACCOUNT` or `OWNER_UIDS` not set yet. Harmless until configured. |
| `FIREBASE_SERVICE_ACCOUNT is not valid JSON` | Paste the entire key file including `{ }`. |
| `Board not found` for a board | Wrong identifier — check the employer's careers URL (API_CONFIGURATION.md). |
| `ADZUNA_APP_ID / ADZUNA_APP_KEY not configured` | Add the secrets, or disable Adzuna in *Search preferences*. |
| HTTP 401/403 from Adzuna/Reed | Key wrong or revoked — regenerate and update the secret. |
| HTTP 429 | Rate limit. Lower *max queries per source* in preferences. |
| Scheduled runs stopped | GitHub pauses schedules after 60 days without repo activity — Actions → Refresh jobs → *Enable workflow*. |
| Manual "Refresh jobs" button seems to do nothing | It's queued and picked up by the next 3-hourly run. Use *Run now on GitHub* for an immediate run. |

## Local development

| Symptom | Fix |
|---|---|
| `npm ci` fails | Use Node 20+ (`node -v`). |
| `npm run refresh:dry` prints `fetch failed` for every board | Your network/proxy blocks the job-board hosts; try another network. |
| Local page loads but shows setup screen | Create `.env` from `.env.example` and restart `npm run dev`. |
