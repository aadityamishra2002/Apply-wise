# Apply Wise Product Status

**Last updated:** October 20, 2026
**Live site:** https://apply-wise-1.vercel.app
**Repository:** https://github.com/aadityamishra2002/Apply-wise

**Current launch status:** blocked. The Vercel frontend returned HTTP 200, but its configured Railway API hostname returned `404 Application not found` on October 20, 2026. The API-dependent account flows are unavailable. The selected recovery route is a Vercel frontend with a Render Free API, Supabase Free PostgreSQL, and Upstash Redis Free; the services have not been provisioned or deployed yet. This checkout includes the Render blueprint and in-process worker option for that demo route.

## What Apply Wise Does

Apply Wise helps a job seeker upload a master resume, discover relevant live jobs, understand fit, prepare truthful application drafts, and track each opportunity from saved role to offer or rejection.

## Live Architecture

| Layer | Technology | Current role |
|---|---|---|
| Web app | Next.js 15, TypeScript, Tailwind CSS | Responsive SaaS interface deployed on Vercel |
| API | FastAPI, Python | Render Free is the selected demo target; previous Railway hostname is inactive |
| Database | PostgreSQL, SQLAlchemy, Alembic | Supabase Free is the selected demo target for users, resumes, jobs, scores, drafts, applications, and analytics |
| Rate limits and queue support | Redis plus PostgreSQL-backed job queue | Upstash Redis Free is the selected demo target; Render demo runs the queue worker inside the API process |
| Job source | Adzuna API, Remotive API | Live India listings and remote-job listings with attribution |
| Authentication | JWT access tokens and refresh-token rotation | Protected user workspaces |

The selected free setup is for a demo and limited feedback, not dependable production use. Render can sleep and restart, Supabase Free can pause after low activity and has no automatic backups, and Upstash Redis Free has monthly command and storage limits. See the setup steps and current provider limits in [DEPLOYMENT.md](DEPLOYMENT.md). No provider service or API URL has been switched yet.

## Implemented User Journey

1. Register or log in.
2. Upload a PDF or DOCX master resume.
3. Review extracted sections, recognized skills, structured experience, education, certifications, and projects.
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
17. Import a public job URL or paste a role from any career page, score it, and save it into the tracker.
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
38. Request and confirm password resets with one-time tokens in local/test environments, send production reset emails when SMTP is configured, revoke sessions after reset, and show a support recovery path when automated email is unavailable.
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
65. Add a configurable extension API URL so the browser helper can be repointed when the backend domain changes.
66. Scope extension host permissions to the configured backend hostname so saved API URL changes continue to work.
67. Add authenticated account data export from Settings while excluding password hashes, tokens, and payment credentials.
68. Add active and archived application views so rejected or withdrawn roles stay out of the working pipeline without deleting history.
69. Add resume page next-step guidance from parsed resume to job matches, saved roles, and Review Application.
70. Show account data export events clearly in the dashboard activity timeline.
71. Add resume-aware empty-state guidance on Jobs so users know when to upload a resume, broaden search, or paste a job manually.
72. Add editable application profile fields in Settings and use them to improve Review Application/autofill mapping.
73. Clean Applications page review/material labels to avoid separator encoding artifacts in production UI.
74. Clean extension autofill preview labels and bump the unpacked extension version for reload clarity.
75. Add dashboard launch checklist backed by resume/profile/match/application/preparation/review readiness.
76. Add explicit confirmation before marking an application as applied to reinforce manual final submission.
77. Enforce manual-submission confirmation on the API before accepting an applied status.
78. Replace visible compliance-page business placeholders with founder/location/support details for payment review readiness.
79. Mark QA/STAGE promotion documentation as paused while MVP work ships directly to `prod` (historical; release flow was subsequently restored).
80. Validate application-profile URLs server-side before using them for review/autofill mapping.
81. Surface API validation details in Settings when application-profile fields cannot be saved.
82. Record extension form-inspection and autofill execution failures in the application timeline with manual fallback guidance.
83. Improve extension field detection with ARIA-linked labels, nearby question text, and common employer-form data attributes.
84. Validate extension syntax and popup element contract in CI alongside backend and web checks.
85. Fix LinkedIn job extraction to use scoped job-detail selectors, support `/jobs/view/{jobId}` and `/jobs/collections/recommended/?currentJobId={jobId}`, block noisy descriptions, show selector diagnostics, and keep company missing instead of falling back to `linkedin.com`.
86. Harden LinkedIn extraction after real browser regression by adding dynamic content wait/retry, real-DOM diagnostics, focused candidate-container text fallback, document-title parsing, and selector-count reporting.
87. Add LinkedIn visible job-card fallback for pages where company appears above the title, location appears below the title, and description starts under "About the job"; add body text length/first-1000 diagnostics and PrismHR regression coverage.
88. Add production resume-project extraction, persisted project records, resume profile edit API, resume re-parse API, project display in the resume workspace, and account export coverage for projects.
89. Add authenticated job URL import with public-URL safety checks, conservative HTML extraction, persisted `url_import` jobs, ATS/match scoring, and Jobs-page import controls.
90. Add a functional web resume-profile editor for correcting skills, experience, education, certifications, and projects after parsing.
91. Add optional SMTP-backed production password-reset email delivery with safe token hiding, frontend reset URL generation, support fallback, env placeholders, and tests.
92. Harden LinkedIn extension capture with explicit host permissions, selector/meta/JSON-LD/visible-text extraction layers, editable manual fallback for missing required fields, copyable debug report, extension version display, and structured backend capture errors.
93. Fix the real Brave/Chrome injection regression where the LinkedIn extractor called an external helper that was not available inside the active tab context; the injected extractor is now self-contained and covered by regression tests.
94. Add LinkedIn description recovery for separate `job-details-about-the-job-module` layouts and include extraction diagnostics in the copyable debug report.
95. Trim LinkedIn visible-text fallback descriptions before job alerts, Premium upsells, more-jobs sections, footer links, and language selectors.
96. Generate stored tailored resumes and cover letters directly from the Jobs page after job capture, with previews, copy/download actions, missing-skills analysis, ATS suggestions, model metadata, and owner-scoped access.
97. Keep persisted manual and extension-captured jobs visible in the Jobs page after refresh by appending the user's stored scored jobs to fresh provider search results.
98. Show a first-time beta checklist for upload resume, pair extension, capture first job, generate materials, apply manually, and mark as applied.
99. Show explicit Assisted Apply readiness blockers and next steps for approval, prepared materials, Review Application confirmation, site autofill support, and manual final submission.
100. Improve empty and error states for missing resume, no captured jobs, expired extension tokens, generation failures, missing company on generic job pages, and no applications yet.
101. Bump the unpacked extension to version `0.3.3` with clearer token-expiry recovery and company-name manual fallback guidance (historical).
102. Verify the live API flow from resume upload through extension capture, stored job visibility, generated materials, downloads, manual-submission confirmation, Applied persistence, owner-scoped access, and missing-resume structured errors.
103. Add source-of-truth developer documentation with maintenance rules, feature ownership map, troubleshooting guide, 30-minute onboarding path, and GitHub PR documentation checklist.
104. Add resume template management with DOCX template upload, active-template selection, rename/delete controls, active-template preview, template-aware tailored-resume generation, generated-version template provenance, and DOCX/PDF downloads that resolve selected template, active fallback template, or the built-in ATS-friendly template.
105. Add a dedicated Prepare Application page for saved/captured jobs with job review, match/ATS scores, matching/missing skills, selected template metadata, generated resume and cover letter editing, DOCX/PDF/TXT downloads, review confirmation, and manual status controls.
106. Add resume-format guidance on upload/template/prepare screens, Remember me email persistence without saving passwords, automatic DOCX master-resume layout selection, and plain-DOCX template fallback that preserves the uploaded document while replacing recognizable sections where possible.

## Resume Template System Verification Update

Local verification completed on June 21, 2026:

- Custom DOCX templates can be uploaded from the new `/resume/templates` page.
- Templates are validated as readable DOCX files before being stored; supported placeholders are recommended but no longer required.
- DOCX master resume uploads create an active user-owned master-resume layout template automatically.
- Users can list templates, select the active template, rename custom templates, delete custom templates, and preview how supported resume sections map into the active layout.
- Supported placeholders are `{{NAME}}`, `{{CONTACT}}`, `{{SUMMARY}}`, `{{PROFESSIONAL_SUMMARY}}`, `{{SKILLS}}`, `{{EXPERIENCE}}`, `{{PROJECTS}}`, `{{EDUCATION}}`, and `{{CERTIFICATIONS}}`.
- Generated resume versions store the selected `template_id` when a custom template is active.
- Resume version responses show `template_id` and `template_name` so the web app can show which template was used.
- DOCX downloads preserve the selected template document structure and replace placeholders with structured resume content.
- Plain DOCX templates without placeholders are used as the base document; recognizable sections are replaced in place while preserving document styling as closely as possible.
- Missing placeholders or unrecognized sections are handled gracefully by appending generated sections after the mapped template content.
- PDF downloads follow the selected template's section order first, then append supported sections that were not present as placeholders. PDF is best-effort and may not be pixel-perfect compared with DOCX.
- If a stored version references a deleted template, downloads fall back to the current active template, then to the built-in ATS template.
- Account export includes resume-template metadata and resume-version template references without exposing raw template bytes.

Manual verification still recommended after deployment:

- Upload a real personal DOCX template in production.
- Generate a resume from a captured job.
- Download DOCX and confirm fonts, margins, headings, spacing, bullet styles, and section order match the template closely.
- Download PDF and confirm all supported sections are present.

## Production Verification Update

Latest live smoke result:

- Historical checks below passed on June 20, 2026; they do not establish current production health. The October 20, 2026 check found the configured API host unavailable as noted above.

- June 20 beta-readiness smoke used a disposable production account and passed the main API-backed user flow.
- Railway API health returned `ok`.
- Railway database readiness returned `ready`, confirming PostgreSQL connectivity.
- Gemini, Adzuna, and Remotive feature flags are enabled in production.
- Production schema accepts and returns generation metadata added by Alembic migration `c81d2f9a7b45`, confirming the migration is applied.
- A throwaway production account successfully uploaded a DOCX master resume.
- A LinkedIn-style captured job was scored with match score, ATS score, matching skills, and missing skills.
- Direct `POST /jobs/{id}/resume-versions` generated and stored a tailored resume with prompt version, provider/model metadata, ATS score, and `created_at`.
- Direct `POST /jobs/{id}/cover-letters` generated and stored a cover letter with prompt version, provider/model metadata, ATS score, and `created_at`.
- Stored `GET /resume-versions/{id}` and `GET /cover-letters/{id}` returned the generated artifacts after creation.
- Authenticated DOCX/PDF resume downloads and TXT cover-letter download returned successfully.
- Generated smoke-test content did not add the unverified `Kubernetes` skill when it appeared only in the job description.
- Owner-scoped access returned `404` for another user trying to generate against the captured job.
- Extension pairing and extension job capture succeeded with a production extension token.
- The deployed Jobs page bundle contains the `Generate Tailored Resume` and `Generate Cover Letter` actions.
- Post-deployment smoke confirmed a captured job remains visible from `/jobs` after refresh, with saved state and application ID preserved.
- The captured job returned match score, ATS score, matching skills, and missing skills in production.
- Manual application submission remains enforced: marking Applied without confirmation returned `409`, while confirmed Applied status persisted after refresh.
- Missing-resume extension capture returned a structured `missing_resume` error with a clear upload-resume action.
- Owner-scoped generation returned `404` for another user trying to generate materials for the captured job.
- The current beta-onboarding patch is deployed: Railway serves the new dashboard-summary fields and Vercel client chunks include the updated dashboard, Jobs, and Applications guidance.

Issue found and fixed:

- Production smoke testing showed a captured job could generate materials by ID, but was not guaranteed to reappear from `GET /jobs` after a refresh because that endpoint only returned fresh provider-search results.
- The API now appends the user's persisted scored jobs, including manual and extension-captured jobs, to fresh provider results while avoiding duplicates.
- Regression coverage confirms a captured and saved job reappears from `/jobs`, preserving saved state, application ID, and approval status.
- Post-deployment production smoke confirmed the fix on Railway.

Remaining production manual checks:

- Repeat the LinkedIn extension flow in the user's real Brave/Chrome profile with the user's real paired extension.
- Confirm the captured LinkedIn job appears on the deployed Jobs page after a full browser refresh from that browser session.
- Generate the tailored resume and cover letter from that captured job in the deployed web app.
- Refresh the Jobs page and confirm generated artifacts remain downloadable from the Resume/Applications workspaces.

## Beta Readiness Status

Current status: **not ready for live user onboarding until the production API is restored.** After recovery, the product still needs the manual beta checks below and the production environment checklist in `docs/DEPLOYMENT.md`.

What is ready for beta:

- Public registration/login, resume upload, live job search, manual job paste/import, extension capture, ATS/match scoring, application tracking, generated resume drafts, generated cover letters, authenticated downloads, activity timelines, and manual Applied tracking.
- First-time users now see a practical checklist instead of guessing the next step.
- Empty/error states now guide users toward resume upload, extension pairing, job capture, manual company correction, and manual submission.
- The extension tells users how to recover from expired pairing tokens and how to manually fix missing company fields before sending.

Still needs manual beta verification:

- Reload the unpacked extension in the user's real Brave/Chrome profile and confirm the popup shows version `0.4.0` after these changes are deployed.
- Capture a real LinkedIn job from the user's authenticated LinkedIn session and confirm the saved job appears in the deployed Jobs page.
- Generate materials from that real captured job and review the output quality before using it externally.
- Track any employer-site extraction/autofill misses with the debug report so selectors can be hardened quickly.

## Current Production Audit

Completed:

- Phase 1 resume upload, PDF parsing with PyMuPDF, DOCX parsing, extracted-text storage, skill extraction, experience extraction, education extraction, certification extraction, project extraction, resume profile API, profile update API, web profile editor, and re-parse API are now implemented.
- Phase 2 job ingestion has provider abstraction, normalization, deduplication, persistent jobs, manual JD capture, URL import, and Chrome extension capture.
- Phase 3 matching has configurable score weights, skills/keyword/experience/education style scoring, missing skills, matching skills, explanations, and stored job-match records.
- Phase 4 AI generation has evidence-grounded resume tailoring, cover letter generation, direct Jobs page preparation after capture, resume-version storage, generation history, model/fallback metadata, and unsupported-claim checks.
- Phase 5 application tracking has saved/preparing/applied/interview/rejected/offer/withdrawn statuses, notes, timeline events, interviews, duplicate prevention, and dashboard metrics.
- Phase 6 extension integration has site-aware extraction and manual-submit-only assisted workflow foundations. LinkedIn still needs real-browser reload testing whenever LinkedIn changes the DOM.
- Phase 7 security has JWT auth, refresh-token rotation, admin role allowlist, rate limiting, audit logs, environment validation, and account export/deletion guidance.

Highest-impact remaining production work:

1. Provision the selected demo services, set their secrets, deploy the Render blueprint, update Vercel `NEXT_PUBLIC_API_URL`, and complete live account and job-preparation smoke checks.
2. Before real-user use, move to dependable hosting with database backups and recovery rehearsal, a separately managed worker, monitoring, production email delivery, and separate QA/STAGE data stores.
3. Enforce GitHub branch protection and required checks for the documented QA -> STAGE -> main release flow.
4. Continue hardening extension extraction with real-world samples; configure payment checkout only after business approval if paid plans are needed.

## LinkedIn Extraction Reliability Update

Root cause found:

- The LinkedIn adapter did not have enough fallbacks for the current LinkedIn job-detail DOM.
- When description selectors missed, the extension fell back to `document.body.innerText`, which pulled navigation, login prompts, Premium banners, recommended jobs, company profile sections, footer content, and unrelated roles.
- Company fallback used the hostname, so missing company data became `www.linkedin.com`.
- A later real-browser regression showed the authenticated LinkedIn DOM available to the content script could miss all strict selector fixtures while still containing useful job text in the main job-detail area. Extraction also needed to wait for LinkedIn's dynamic content before reading the DOM.
- A follow-up real-browser test on `https://www.linkedin.com/jobs/view/4424855234/` showed the visible LinkedIn card layout can expose company above title, title as the large heading, location below title, and description under "About the job" while strict selectors still return zero matches.
- A later Brave test still returned completely empty fields because the injected `extractPage()` function referenced a popup-context helper that was not serialized into the active LinkedIn tab. The extractor now defines its LinkedIn wait/retry helper inside the injected function so it can run in the real page context.
- A real LinkedIn capture then returned title, company, and location but an empty description. The LinkedIn adapter now checks newer separate about-the-job module selectors and scans description candidate nodes beyond the chosen top-card container.
- A follow-up LinkedIn capture showed the fallback description could include the correct job text plus job-alert, Premium, more-jobs, footer, and language-selector noise. Cleanup now stops before those sections.
- The latest fix keeps Send disabled only for true required fields: title, company, URL, and a 40+ character description. Location is optional, and the user can manually fix required fields in the popup before sending.
- Backend extension capture now returns top-level structured JSON errors with `ok`, `error_code`, `message`, and `details` for missing title, missing company, missing URL, short description, missing resume, invalid/expired extension token, and database save errors.

Fixes implemented:

- LinkedIn extraction now uses multiple scoped selectors for title, company, location, and description.
- LinkedIn descriptions are restricted to job-description containers only and trimmed before seniority, similar-jobs, referral, alert, and footer sections.
- The extension supports both direct job URLs and collection URLs with `currentJobId`.
- Company no longer falls back to the LinkedIn hostname; missing company remains missing and blocks send.
- The popup shows extraction diagnostics for title, company, location, description, and URL format.
- The popup shows a copyable LinkedIn debug report with active tab URL, matched site type, extraction layer, field lengths, token presence, backend API URL, backend status/body, and validation errors.
- The **Send to Apply Wise** button is disabled when title, company, URL, or a 40+ character description is missing. Location and deeper description quality are warnings only.
- The popup warns when the configured Apply Wise API backend is unreachable.
- CI now runs extension extraction regression tests for LinkedIn, Naukri, Workday, one generic company career page, and capture-quality validation.
- Re-extract now waits for LinkedIn job content before reading the page.
- LinkedIn diagnostics now include `document.readyState`, candidate container existence, selected candidate container selector, candidate text length, first 500 characters of candidate text, and selector-match counts for title/company/location/description groups.
- LinkedIn diagnostics now also include `document.body.innerText.length`, the first 1000 characters of `document.body.innerText`, TreeWalker visible-text length, and first 1000 characters of collected visible text.
- Copy Debug Report now includes the full extraction diagnostics array, including description selector counts and fallback candidate details.
- LinkedIn fallback descriptions now trim before job-alert, Premium, more-jobs, footer, and language-selector sections when LinkedIn only exposes broad visible text.
- If exact selectors miss, LinkedIn extraction now falls back to document-title parsing and focused candidate-container text heuristics while still trimming before similar jobs, recommendations, footer, referrals, and profile sections.
- If selectors and title parsing miss, LinkedIn extraction now scans the visible card text around the detected title to recover company-above-title and location-below-title layouts.

Fully working in automated verification:

- LinkedIn extraction regression for `https://www.linkedin.com/jobs/view/4425607893/` returns `AI Senior Software Engineer`, `Sopra Steria`, `Noida, Uttar Pradesh, India`, and a focused job description without similar-jobs/navigation/footer noise.
- LinkedIn real-DOM fallback regression covers the case where strict selectors are missing but the main candidate container text contains the job details.
- LinkedIn PrismHR fallback regression covers `AI/ML Engineer`, `PrismHR`, `Noida, Uttar Pradesh, India`, and the description starting with "We are seeking a highly skilled AI/ML Engineer...".
- LinkedIn collection URL extraction is covered for `/jobs/collections/recommended/?currentJobId={jobId}`.
- Naukri, Workday, and generic company-career extraction samples populate title, company, location, and description.
- Extension capture-quality validation blocks missing title, missing company, invalid URL, and descriptions under 40 characters. Location and longer-description quality are warnings only so the user can manually fix and send LinkedIn captures when LinkedIn hides optional fields.
- Extension API capture test verifies LinkedIn job submission, saved application persistence, ATS/match scoring, tailored resume generation, cover letter generation, and application timeline audit events.

Remaining limitations:

- LinkedIn changes markup often, so the diagnostics panel should be checked when a field becomes missing.
- Authenticated LinkedIn pages can differ from public pages; users should reload the extension and use **Re-extract current page** after expanding the full job description.
- Final browser-level verification of saving to the user's live account still requires a valid extension pairing token from the logged-in Apply Wise Settings page.

Still needs manual browser testing:

- Reload the unpacked extension in Brave/Chrome and confirm the popup UI shows the same LinkedIn values on the real authenticated LinkedIn page.
- Test both LinkedIn URLs currently known to fail:
  - `https://www.linkedin.com/jobs/view/4424855234/`
  - `https://www.linkedin.com/jobs/view/4425607893/`
  - `https://www.linkedin.com/jobs/view/4424582004/?alternateChannel=search&eBP=BUDGET_EXHAUSTED_JOB&trk=d_flagship3_jobs_discovery_jymbii&refId=D6ZVOyifP0bVAzF0nWvuiQ%3D%3D&trackingId=H6NdQFF1Jn4tTjU2w5rcuA%3D%3D`
- Pair the extension with the user's live Apply Wise account and confirm the captured job appears in the deployed web app.
- Prepare materials in the web app for that captured job and confirm the generated resume/cover-letter previews are acceptable for user review.

Exact LinkedIn capture to generated-materials test:

1. Reload the unpacked extension in Brave or Chrome.
2. Open Apply Wise Settings and generate a fresh extension pairing code.
3. Pair the extension.
4. Open a LinkedIn job page and expand the full job description.
5. Click the Apply Wise extension and choose **Re-extract current page**.
6. Confirm title, company, URL, and a focused 40+ character description are present.
7. Manually fix any missing required field in the extension popup.
8. Click **Send to Apply Wise**.
9. Open Apply Wise **Jobs**.
10. Select the captured job.
11. Confirm match score, ATS score, matching skills, and missing skills are shown.
12. Click **Generate Tailored Resume** and review the preview.
13. Use **Copy**, **DOCX**, and **PDF** actions for the resume.
14. Click **Generate Cover Letter** and review the preview.
15. Use **Copy** and **TXT** actions for the cover letter.
16. Refresh the Jobs page and confirm the captured job still appears.
17. Open Applications and continue the manual Review Application workflow before applying.

## Truthfulness Rules

Generated application drafts use stored resume evidence only. The current implementation does not invent employers, skills, projects, responsibilities, or achievements. Every draft remains review-required before use.

## Security and Operations

- Passwords are hashed with Argon2id.
- Refresh tokens rotate and replay attempts revoke the token family.
- Refresh cookies are HTTP-only.
- Logged-in password changes verify the current password and revoke existing refresh sessions.
- Owner admin access is configured through an environment-variable allowlist.
- Production secrets belong in provider environment variables and are not committed to Git.
- The API exposes health and database/Redis readiness probes.
- PostgreSQL schema changes use Alembic migrations.

## Current Limitations

- Adzuna and Remotive are connected; more provider integrations and deeper direct company-career-page adapters remain future work.
- Resume parsing uses deterministic heuristics and still needs user review.
- Gemini tailoring uses strict evidence-grounding instructions and falls back safely when API quota is unavailable.
- Payment checkout, webhook processing, and paid-plan activation are not connected and are intentionally out of scope for the current product work.
- Assisted autofill is beta-safe and review-gated; direct resume-file upload into external sites and real Playwright browser control remain future work.
- The selected free hosting stack is a demo route; cold starts, free-tier pauses/restarts, limited quotas, and lack of automatic free-tier backups are not suitable reliability guarantees for real users.

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
| Add duplicate-application prevention, audit logs, retry handling, and rate limits | Implemented in this checkout; deployment pending | Duplicate prevention, audit events, and retries are implemented. Shared rate limiting uses Redis, and a PostgreSQL-backed worker claims queued application-preparation jobs. The Render demo runs that worker in-process; production should use a separately managed worker. |
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
cd ..\..
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check apps\extension\popup.js
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' apps\extension\tests\extraction-regression.test.js
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' apps\extension\tests\manifest-popup-contract.test.js
```

LinkedIn extension smoke test:

1. Reload the unpacked extension from `brave://extensions` or `chrome://extensions`.
2. Open `https://www.linkedin.com/jobs/view/4425607893/`.
3. Click the Apply Wise extension and choose **Re-extract current page**.
4. Confirm the popup shows:
   - Title: `AI Senior Software Engineer`
   - Company: `Sopra Steria`
   - Location: `Noida, Uttar Pradesh, India`
   - Description: only the actual job description, without navigation, Premium prompts, recommended jobs, footer, or unrelated roles.
5. Open **Extraction diagnostics** and confirm each field shows a LinkedIn selector instead of `missing`.
6. Confirm **Send to Apply Wise** remains disabled if title, company, URL, or a focused 40+ character description is missing. Location is optional when LinkedIn hides it.
7. Pair the extension from Apply Wise Settings, send the job, then verify the saved job appears in Apply Wise Jobs/Applications and ATS/match scoring is shown.

Additional extractor checks:

- Naukri: open a Naukri job detail page, re-extract, and verify title/company/location/description are populated.
- Workday: open a `myworkdayjobs.com` job posting, re-extract, and verify the Workday adapter extracts title/company/location/description.

## Extension Usage Steps

1. Open Settings in Apply Wise and generate a one-time extension pairing code.
2. Load the unpacked extension from `apps/extension` in Chrome or Brave.
3. Pair the extension using the code.
4. Open a job page, review the captured job details, and send it to Apply Wise.
5. Prepare materials in Apply Wise, open Review Application, and confirm manual review.
6. Use extension autofill only after previewing and approving fields.
7. Attach the generated resume manually if the browser blocks file upload automation.

## Deployment Note

The public frontend is reachable, but API-backed registration and user workflows are blocked because the configured Railway API host returned `404 Application not found` (checked October 20, 2026). The chosen recovery route is Render Free + Supabase Free + Upstash Redis Free, with the frontend kept on Vercel. `render.yaml` and the setup guide are ready, but the services, provider secrets, exact Render hostname, Vercel `NEXT_PUBLIC_API_URL`, and live workflow checks still need to be completed in their dashboards. Follow `QA -> STAGE -> main` for release after configuring the documented GitHub protections; the free demo route should not be treated as production-ready for real-user data.
