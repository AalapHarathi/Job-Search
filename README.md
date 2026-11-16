# Career Intel

A private job-discovery and application-tracking dashboard. It finds analyst-type vacancies on employers' own careers boards and job APIs, checks that each one is genuinely open, reads its visa-sponsorship stance, scores it against your resume, and tracks every application in Firebase.

**Daily workflow:** open the dashboard → review new verified vacancies → check match score and sponsorship → open the employer's application page → apply yourself → *Mark applied* → track follow-ups and interviews.

Nothing is ever submitted on your behalf, and no job, link, salary or date is invented. When something can't be confirmed, the dashboard says so.

## What's inside

| Area | What it does |
|---|---|
| Overview | KPI strip, top 10 recommendations, recommended actions, refresh status, deadlines, discovery activity, pipeline, success rates, recent applications — all computed from Firestore. |
| Discover jobs | Sortable, filterable table (country, title search, company, salary, experience, arrangement, sponsorship, match, posting window, employment type, verification). Every row: description, company site, *Apply on company site*, save, mark applied, not interested, match analysis. |
| Recommended for me | Open vacancies above your score threshold that sponsorship doesn't rule out, ranked by match → freshness → sponsorship → deadline, each with its reasons. |
| Saved / Applied / Pipeline / Rejected | Status tracking with 12 statuses, drag-and-drop interview pipeline, follow-up and interview dates, history timeline. |
| Resume intelligence | PDF/DOCX upload (parsed in the browser), multiple versions, primary version, editable extracted profile, suggested titles, optional AI profile, tailored resume and cover letter (.docx). |
| Analytics | Applications by country, category, company, week/month; conversion, interview, success and rejection rates; average match; full history timeline. |
| Search preferences | Countries and priority, titles, exclusions, freshness rules, recommendation threshold, employer boards, job APIs. |
| Notifications | Strong new matches, saved jobs closing or disappearing, follow-ups, interviews, status changes, new roles at companies you've applied to. Optional email digest. |

## Architecture

```
 GitHub Pages (static React app)  ──reads/writes──▶  Cloud Firestore  ◀──Admin SDK──  GitHub Actions (refresh job)
          │                                          users/{uid}/…                       │
          └── Firebase Auth (email, Google) ─────────────┘                               ├─ Greenhouse / Lever / Ashby (public, no key)
                                                                                         ├─ Adzuna API (free key)
                                                                                         ├─ Reed API (free key, UK)
                                                                                         └─ Optional LLM (server-side key)
```

- **No Cloud Functions needed.** The scheduled refresh runs in GitHub Actions, so Firebase stays on the free Spark plan.
- **Keys never reach the browser.** Only the public Firebase web config is in the frontend; API keys and the service account live in GitHub Secrets.
- **Same scoring engine everywhere.** `shared/matching.ts` runs in the refresh job and in the browser (when you upload or edit a resume), so scores are consistent.

### Vacancy verification

| Situation | Status |
|---|---|
| Listed on the employer's Greenhouse/Lever/Ashby board this run | **Verified** (plus a page check for new/tracked jobs) |
| Was on the employer's board, now isn't (and the board loaded fine) | **Closed** — removed from feeds, history kept |
| Employer board errored this run | **Unverified** — never assumed open |
| Found only on Adzuna/Reed | **Unverified** — employer listing not confirmed; no employer apply link is invented |
| Page returns 404/410 or says "no longer accepting applications" | **Closed** |
| Published closing date has passed | **Closed** |

Freshness: Very recent ≤3 days, Recent ≤7, Active ≤14, Older active ≤30. The default feed shows ≤14 days. Anything over 30 days appears only if it is Verified *and* you enable older vacancies. Jobs with no published date are shown as "Not given" (toggle in preferences) — dates are never estimated. Adzuna's *predicted* salaries are discarded.

### Sponsorship classification

Read from the posting text (`shared/sponsorship.ts`), checked in this order so refusals win over generic phrases:
**D** No sponsorship → **E** Local work authorization required → **A** Sponsorship confirmed → **B** Possibly available (relocation/visa support hints) → **C** Not mentioned. India-based roles are marked *Not required*. The exact sentence used as evidence is shown on every vacancy. D/E roles are excluded from recommendations when you need sponsorship. For **C** roles, check the employer yourself (e.g. the UK Home Office *Register of licensed sponsors: workers*).

### Match scoring (out of 100)

| Component | Points | How it's earned |
|---|---|---|
| Skills | 30 | Skills named in the posting that appear on your resume (core skills like SQL/Power BI count double; equivalent tools like Tableau↔Looker get half credit). |
| Experience | 25 | Your dated experience vs. the years requested (or the title's seniority if none is stated). |
| Responsibilities | 20 | Overlap of day-to-day themes (dashboards, reporting, requirements, stakeholders, process improvement…). |
| Education | 10 | Degree level and field vs. what's required (preferences don't penalise). |
| Industry | 10 | Shared domain; domain-agnostic roles get a neutral 7. |
| Location & visa | 5 | Home country 5, sponsorship confirmed 5, possible 3, not mentioned 2, refused/local-only 0. |

90+ Excellent, 80+ Strong, 70+ Good, 60+ Moderate, below 60 Low. Each component shows its reasoning. If an LLM key is configured, it writes the narrative analysis for the strongest matches — it never changes the number.

## Repository layout

```
shared/            domain logic used by browser + refresh job (types, matching, sponsorship, dedupe, resume parser)
scripts/refresh/   scheduled job: sources/, verification, LLM, email, orchestrator
scripts/selftest.ts  engine tests (run in CI before every deploy)
scripts/dryrun.ts    check your sources without Firebase
src/               React + TypeScript app (pages/, components/, context/, lib/)
firestore.rules    strict per-user Security Rules
.github/workflows/ deploy.yml (Pages) and refresh-jobs.yml (schedule)
```

## Setup

1. **Firebase** — follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md).
2. **GitHub** — follow [DEPLOYMENT.md](DEPLOYMENT.md).
3. Sign in, upload your resume in *Resume intelligence*, save *Search preferences*, then run the *Refresh jobs* workflow once.

Local development:

```bash
npm install
cp .env.example .env      # fill in the VITE_FIREBASE_* values
npm run dev               # http://localhost:5173
npm run test:engine       # scoring / sponsorship / parser checks
npm run refresh:dry       # confirm your company boards respond (no Firebase needed)
```

## Known limits

- **LinkedIn, Indeed, Glassdoor and Workday** have no permitted public job-search API for personal use, so they aren't scraped. Workday employers can still appear via Adzuna/Reed (as Unverified). Greenhouse, Lever and Ashby cover a large share of tech and scale-up employers; add the ones you want in *Search preferences*.
- **Coverage depends on the boards you track.** The starter list is small and global. Adding UK and Australian employers known to sponsor (and Indian employers you like) is the single biggest improvement you can make.
- **Resume parsing is heuristic.** Check *Extracted information* after uploading and correct anything misread; every score depends on it.
- **Sponsorship is read from text.** It's evidence, not a legal determination — confirm with the employer for anything you pursue seriously.
- **Manual refresh is queued**, not instant: the button is picked up by the 3-hourly check, or use *Run now on GitHub* for an immediate run.
