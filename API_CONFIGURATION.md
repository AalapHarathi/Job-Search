# API configuration

All job-source and AI calls run **server-side** in the `Refresh jobs` GitHub Actions workflow (`.github/workflows/refresh-jobs.yml` → `scripts/refresh/index.ts`). The browser never calls these APIs and never sees these keys.

Add every value below at **GitHub → AalapHarathi/Job-Search → Settings → Secrets and variables → Actions**. *Secrets* are encrypted and masked in logs; *Variables* are plain text.

## Required for the refresh job

| Name | Type | What it is | Where to get it |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Secret | Full service-account JSON (Admin SDK) | Firebase console → Project settings → Service accounts → *Generate new private key*. Paste the whole file. Delete the downloaded file afterwards. |
| `OWNER_UIDS` | Secret | Your Firebase Auth UID (comma-separated for several) | Firebase console → Authentication → Users → *User UID*, after your first sign-in. The workflow refuses to run without it so other sign-ups can never consume your quotas. |

## Job sources

| Source | Key needed? | Secret(s) | Coverage | Verification level |
|---|---|---|---|---|
| Greenhouse boards (`boards-api.greenhouse.io`) | No | — | Employers you list in *Search preferences* | **Verified** (employer's own board) |
| Lever boards (`api.lever.co`) | No | — | 〃 | **Verified** |
| Ashby boards (`api.ashbyhq.com`) | No | — | 〃 | **Verified** |
| Adzuna Search API | Yes (free developer key) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | GB, AU, IN, US, DE, NL, CA, SG, NZ | Unverified (aggregator; no employer link invented) |
| Reed Jobseeker API | Yes (free) | `REED_API_KEY` | UK | Unverified |

- **Adzuna:** register at <https://developer.adzuna.com> → *Dashboard* → copy *Application ID* and *Application Key*.
- **Reed:** register at <https://www.reed.co.uk/developers/jobseeker> → copy the API key emailed/shown to you.
- **Board identifiers:** the part of the employer's careers URL, e.g. `boards.greenhouse.io/monzo` → `greenhouse:monzo`, `jobs.lever.co/acme` → `lever:acme`, `jobs.ashbyhq.com/acme` → `ashby:acme`. Add them in the dashboard under *Search preferences*.

Not supported: LinkedIn, Indeed, Glassdoor, Workday — no permitted public job-search API for personal use.

## Optional: AI narrative analysis

| Name | Type | Notes |
|---|---|---|
| `LLM_API_KEY` | Secret | Anthropic (<https://console.anthropic.com>) or any OpenAI-compatible provider key. Pay-as-you-go. |
| `LLM_PROVIDER` | Variable | `anthropic` (default) or `openai` |
| `LLM_MODEL` | Variable | **Set this explicitly** to a current model ID from your provider's model list. The code's built-in default may not match a model your account offers. |
| `LLM_BASE_URL` | Variable | OpenAI-compatible providers only (default `https://api.openai.com/v1`) |
| `LLM_MAX_JOBS_PER_RUN` | Variable | Default 20; caps spend per run |

The LLM writes explanatory text only; match scores always come from `shared/matching.ts`.

## Optional: email digest

| Name | Type | Example |
|---|---|---|
| `SMTP_URL` | Secret | `smtps://you%40gmail.com:APP-PASSWORD@smtp.gmail.com:465` (Gmail needs 2-Step Verification + an app password) |
| `SMTP_FROM` | Secret | Sender address; defaults to `NOTIFY_EMAIL` |
| `NOTIFY_EMAIL` | Secret | Where digests go |
| `DASHBOARD_URL` | Variable | Defaults to `https://aalapharathi.github.io/Job-Search/` |

## Testing keys locally

```bash
npm run refresh:dry                                        # public boards, no keys, no Firebase
npm run refresh:dry -- greenhouse:monzo lever:acme         # specific boards
ADZUNA_APP_ID=… ADZUNA_APP_KEY=… REED_API_KEY=… npm run refresh:dry
```

Never put any of these in a `VITE_*` variable — Vite bundles every `VITE_*` value into the public JavaScript.
