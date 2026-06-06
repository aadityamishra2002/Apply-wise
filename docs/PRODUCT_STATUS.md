# Apply Wise Product Status

**Last updated:** June 5, 2026
**Live site:** https://apply-wise-1.vercel.app
**Repository:** https://github.com/aadityamishra2002/Apply-wise

## What Apply Wise Does

Apply Wise helps a job seeker upload a master resume, discover relevant live jobs, understand fit, prepare truthful application drafts, and track each opportunity from saved role to offer or rejection.

## Live Architecture

| Layer | Technology | Current role |
|---|---|---|
| Web app | Next.js 15, TypeScript, Tailwind CSS | Responsive SaaS interface deployed on Vercel |
| API | FastAPI, Python | Authenticated application API deployed on Railway |
| Database | PostgreSQL, SQLAlchemy, Alembic | Users, resumes, jobs, scores, drafts, applications, analytics |
| Job source | Adzuna API, Remotive API | Live India listings and remote-job listings with attribution |
| Authentication | JWT access tokens and refresh-token rotation | Protected user workspaces |

## Implemented User Journey

1. Register or log in.
2. Upload a PDF or DOCX master resume.
3. Review extracted sections, recognized skills, structured experience, education, and certifications.
4. Search live Adzuna and Remotive listings by role or keyword.
5. Review explainable profile-match scores and missing skills.
6. Save a role into the application tracker.
7. Prepare a Gemini-enhanced evidence-grounded resume version and cover-letter draft with deterministic fallback.
8. Update application status and monitor dashboard metrics.
9. Review pipeline analytics and generated resume-version history.
10. Save role, location, and remote-only job-discovery preferences.
11. Add application notes and review visible timeline events.
12. Schedule interview rounds within an application workspace.
13. Download authenticated DOCX or PDF exports for prepared resume versions.
14. Review persisted free-tier or owner-bypass subscription entitlements in settings.
15. Review non-secret provider health for the configured job-source aggregator.
16. Reschedule interviews, edit preparation notes, or remove obsolete rounds.
17. Paste a role from any career page, score it, and save it into the tracker.
18. Pair an unpacked Chrome extension with a one-time code and review captured job pages before scoring.
19. Review a distinct ATS-readiness breakdown and approve or dismiss roles in the `80+` queue.
20. Review duplicate protection, draft readiness, and the employer-page handoff before manually submitting an application.
21. Inspect common employer application fields locally from the extension before assisted autofill.
22. Capture cleaner Greenhouse, Lever, LinkedIn, Indeed, Naukri, and common company-career job-page details through site-aware extension adapters with a generic fallback.
23. Change the logged-in account password from Settings and revoke existing refresh sessions.
24. Review skill recommendations learned from missing skills across matched and approved roles.
25. Review public Terms, Privacy, Refund Policy, Contact, and free-beta pricing pages.
26. See already-saved jobs reflected in recommendations and manual capture results.
27. Track the first applied date when an application is marked Applied.
28. Discover remote roles through the Remotive provider with short-lived API caching and visible source attribution.
29. Search by role and location directly from the Jobs page while still falling back to saved preferences.
30. Follow a guided application workflow for approve, prepare, download, employer-page review, and applied-date tracking.
31. Download persisted cover letters as authenticated TXT files after preparation.
32. Open the exact saved application workflow directly from a job recommendation.
33. Filter job recommendations by high-fit score, provider source, and remote-only roles.
34. Review recommendation explanations for matched skills, ATS readiness, missing skills, and seniority fit.
35. Edit and save prepared cover letters before downloading or applying.
36. Edit tailored resume summary, skills, and experience text before DOCX/PDF download.
37. Review extension capture readiness and re-extract the current page before sending a job.
38. Request and confirm password resets with one-time tokens and session revocation.
39. Review owner-only admin summary metrics for users, jobs, applications, generated materials, and subscriptions.
40. Load an extension-scoped autofill plan for a captured application, review mapped fields with confidence scores, and fill only approved fields.
41. Download the latest prepared tailored resume from the extension for manual attachment on employer forms.
42. Track extension autofill previews, fill attempts, tailored-resume downloads, resume-upload assistance attempts, and captured-job events in the application timeline.
43. Review per-site dry-run automation capability flags and manual-submit steps for LinkedIn, Naukri, Indeed, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, and generic career pages.
44. Retry transient AI generation failures with configurable exponential backoff and show generation fallback/attempt metadata in the application workspace.
45. Use a consolidated "Review Before Applying" panel with materials readiness, autofill confidence, manual-attention fields, warnings, and no-auto-submit guardrails.
46. Flag unsupported generated claims for skills, companies, titles, and metrics against the uploaded master resume before applying.

## Truthfulness Rules

Generated application drafts use stored resume evidence only. The current implementation does not invent employers, skills, projects, responsibilities, or achievements. Every draft remains review-required before use.

## Security and Operations

- Passwords are hashed with Argon2id.
- Refresh tokens rotate and replay attempts revoke the token family.
- Refresh cookies are HTTP-only.
- Logged-in password changes verify the current password and revoke existing refresh sessions.
- Owner admin access is configured through an environment-variable allowlist.
- Production secrets remain in Railway variables and are not committed to Git.
- Railway exposes health and database-readiness probes.
- PostgreSQL schema changes use Alembic migrations.

## Current Limitations

- Adzuna and Remotive are connected; more provider integrations and deeper direct company-career-page adapters remain future work.
- Resume parsing uses deterministic heuristics and still needs user review.
- Gemini tailoring uses strict evidence-grounding instructions and falls back safely when API quota is unavailable.
- Payment checkout, webhook processing, and paid-plan activation are not connected.
- Assisted autofill is beta-safe and review-gated; direct resume-file upload into external sites and real Playwright browser control remain future work.

## Pending Work Status

| Item | Status | Notes |
|---|---|---|
| Build a real ATS evaluation engine that separately scores keywords, formatting, sections, and parsing quality | Done | Implemented as distinct keyword, section, formatting, and parse-readiness scoring. |
| Add an `80+` score review queue | Done | High-fit jobs appear in the Jobs page review queue. |
| Add per-job approval controls before preparing or applying | Done | Jobs can be approved or dismissed before preparation. |
| Add site-specific Chrome extension extractors for LinkedIn, Naukri, Indeed, and company career pages | In progress | LinkedIn existed; Indeed, Naukri, Workday, Ashby, SmartRecruiters, and generic company-career adapters added in the current slice. |
| Add assisted autofill for application forms | Partially done | Extension can load an API-generated autofill plan, show confidence/source/sensitive warnings, and fill only reviewed fields. Low-confidence and sensitive fields are unchecked by default. |
| Add resume-file upload support during assisted applications | Partially done | Extension detects resume upload fields, downloads the latest prepared tailored resume for manual attachment, and logs upload assistance. Direct file assignment is not supported because browsers block extensions from setting local file paths. |
| Add Playwright automation adapters for selected job sites | Partially done | Dry-run/manual-submit adapter capabilities and application plans exist for LinkedIn, Naukri, Indeed, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, and generic career pages. Real browser-control execution is still deferred. |
| Add duplicate-application prevention, audit logs, retry handling, and rate limits | Partially done | Duplicate prevention, activity timeline, API rate limiting, extension capture retries, extension autofill audit events, and Gemini generation retries exist; provider/export/background retry visibility remains pending. |
| Keep final submission manual initially; introduce optional automated submission only after real-world testing and explicit user consent | Current policy | Final submission remains manual. |
| Add Razorpay checkout after account verification | Deferred | Payment work is paused until account verification is complete. |

## Next Delivery Slices

1. Add broader retry visibility for external job providers, exports, and long-running jobs.
2. Add real Playwright browser-control execution in dry-run/manual-submit mode after policy and UX review.
3. Add stronger download-time blocking or confirmation for unresolved unsupported-claim warnings.
4. Add payment gateway checkout, verified webhooks, and paid-plan activation after Razorpay verification.

## Deployment Note

The product is live for public account registration. For the current beta push, changes are going directly to `main` after local tests and CI checks to save deployment time. The Railway backend currently depends on the selected Railway plan and usage allowance. Check Railway usage regularly before the trial window ends.
