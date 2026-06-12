# Apply Wise Product Status

**Last updated:** June 11, 2026
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
25. Review public About, Pricing, Terms, Privacy, Refund/Cancellation, Shipping/Delivery, and Contact pages for SaaS/payment-gateway review.
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
40. Load an extension-scoped autofill plan for a captured application, review mapped fields with confidence scores, approve selected fields, log the approval, and fill only approved fields.
41. Download the latest prepared tailored resume from the extension for manual attachment on employer forms, with visible manual-upload-required status when browser upload automation is blocked.
42. Track extension autofill previews, fill attempts, tailored-resume downloads, resume-upload assistance attempts, and captured-job events in the application timeline.
43. Review per-site dry-run automation capability flags and manual-submit steps for LinkedIn, Naukri, Indeed, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Jobvite, iCIMS, BambooHR, Workable, and generic career pages.
44. Retry transient AI generation failures with configurable exponential backoff and show generation fallback/attempt metadata in the application workspace.
45. Use a consolidated "Review Application" panel with job details, match/ATS scores, tailored resume version, cover letter preview, required fields, missing information, warnings, manual review confirmation, and no-auto-submit guardrails.
46. Flag unsupported generated claims for skills, companies, titles, and metrics against the uploaded master resume before applying.
47. Retry transient job-provider failures with configurable backoff and show sanitized retry/error status in provider health.
48. Require explicit confirmation before downloading a tailored resume with unresolved unsupported-claim warnings.
49. Retry resume export generation and record export download attempts in the application timeline.
50. Start and review tracked assisted-application dry-run records with blocked/ready status, warnings, next action, and audit timeline events.
51. Queue material-preparation runs with visible queued/running/succeeded/failed status, attempts, results, retry controls for failed runs, and timeline events.
52. Present compliance-focused public copy with INR pricing, Razorpay trust text, digital SaaS delivery terms, refund rules, support details, FAQ, and third-party job-board disclaimers.
53. Confirm manual application review before assisted application actions and record the confirmation in the application activity timeline.
54. Map autofill fields for full name, first name, last name, email, phone, location, LinkedIn, GitHub, portfolio, education, experience, skills, current company, current role, cover letter, and resume file assistance.
55. Log extension autofill approval and resume upload failure/manual-required events in the user-visible activity timeline.
56. Record explicit audit events for tailored resume generation, cover letter generation, and application marked applied.
57. Show clearer extension messages when a pairing token expires and the user must pair again.
58. Gate extension autofill plans behind the web Review Application confirmation so assisted filling cannot start before manual review.
59. Improve extension field detection using common data attributes and manual-only coverage for work authorization and pronouns.
60. Add explicit Jobvite, iCIMS, BambooHR, and Workable capture/autofill capability adapters for common employer career pages.
61. Improve ATS scoring with job-description keyword fallback when providers do not return structured required skills.
62. Harden extension autofill for modern forms by skipping disabled/read-only/hidden/manual controls and matching select options conservatively.
63. Add a user-visible dashboard activity log for resume upload/parsing, job scoring, and captured-job audit events.
64. Add in-app Settings privacy guidance with a clear support path for account/data deletion requests.
65. Add a configurable extension API URL so the browser helper can be repointed when the Railway backend domain changes.
66. Scope extension host permissions to Railway subdomains so saved backend URL changes continue to work.
67. Add authenticated account data export from Settings while excluding password hashes, tokens, and payment credentials.

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
- Payment checkout, webhook processing, and paid-plan activation are not connected and are intentionally out of scope for the current product work.
- Assisted autofill is beta-safe and review-gated; direct resume-file upload into external sites and real Playwright browser control remain future work.

## Pending Work Status

| Item | Status | Notes |
|---|---|---|
| Build a real ATS evaluation engine that separately scores keywords, formatting, sections, and parsing quality | Done | Implemented as distinct keyword, section, formatting, and parse-readiness scoring with job-description keyword fallback when provider skills are sparse. |
| Add an `80+` score review queue | Done | High-fit jobs appear in the Jobs page review queue. |
| Add per-job approval controls before preparing or applying | Done | Jobs can be approved or dismissed before preparation. |
| Add complete Review Application screen | Done | Application workspace now shows job details, match/ATS scores, tailored resume version, cover letter preview, extracted fields, missing required fields, warnings, and manual review confirmation before assisted actions. |
| Add site-specific Chrome extension extractors for LinkedIn, Naukri, Indeed, and company career pages | In progress | LinkedIn, Indeed, Naukri, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Jobvite, iCIMS, BambooHR, Workable, and generic company-career adapters are now covered. |
| Add assisted autofill for application forms | Done for MVP | Extension loads an API-generated autofill plan only after Review Application confirmation, maps common profile/resume fields, shows confidence/source/sensitive warnings, skips risky/manual controls, logs approved fields, and fills only user-approved fields. |
| Add resume-file upload support during assisted applications | Done for MVP | Extension detects resume upload fields, downloads the latest prepared tailored resume for manual attachment, shows manual-upload-required status, and logs upload attempted/failed-manual-required events. Direct file assignment is not supported because browsers block extensions from setting local file paths. |
| Add Playwright automation adapters for selected job sites | Partially done | Dry-run/manual-submit adapter capabilities, application plans, and tracked assisted-run records exist for LinkedIn, Naukri, Indeed, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Jobvite, iCIMS, BambooHR, Workable, and generic career pages. Real browser-control execution is still deferred. |
| Add duplicate-application prevention, audit logs, retry handling, and rate limits | Partially done | Duplicate prevention, dashboard activity logs, application timeline, API rate limiting, extension capture retries, extension autofill audit events, generated-material audit events, applied-status audit events, Gemini generation retries, provider retries, export retries, assisted-run status tracking, and queued material-preparation status/retry controls exist; dedicated Celery worker execution remains pending. |
| Keep final submission manual initially; introduce optional automated submission only after real-world testing and explicit user consent | Current policy | Final submission remains manual. |
| Add Razorpay checkout after account verification | Deferred | Payment work is paused until account verification is complete. |

## Next Delivery Slices

1. Continue reliability and safety hardening for assisted application actions.
2. Add more employer-site-specific field selectors as real users report gaps.
3. Add deeper extension UX polish after live usage feedback.

## Testing Instructions

Run the core checks before shipping:

```powershell
$env:PYTHONPATH='apps/api'; .\.venv\Scripts\python.exe -m pytest apps/api/tests -q
cd apps\web
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\node_modules\typescript\bin\tsc' --noEmit
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\node_modules\next\dist\bin\next' build
```

## Extension Usage Steps

1. Open Settings in Apply Wise and generate a one-time extension pairing code.
2. Load the unpacked extension from `apps/extension` in Chrome or Brave.
3. Pair the extension using the code.
4. Open a job page, review the captured job details, and send it to Apply Wise.
5. Prepare materials in Apply Wise, open Review Application, and confirm manual review.
6. Use extension autofill only after previewing and approving fields.
7. Attach the generated resume manually if the browser blocks file upload automation.

## Deployment Note

The product is live for public account registration. For the current MVP push, changes are going directly to `prod` after local tests to save time. The Railway backend currently depends on the selected Railway plan and usage allowance. Check Railway usage regularly before the trial window ends.
