# Apply Wise

Apply Wise is a deployed AI-powered job application copilot for resume-aware job discovery, truthful application preparation, and pipeline tracking.

**Live site:** [https://apply-wise-1.vercel.app](https://apply-wise-1.vercel.app)

## Product Status

The maintained product guide is available in two formats:

- [Product status source](docs/PRODUCT_STATUS.md)
- [Product status PDF](docs/APPLY_WISE_PRODUCT_STATUS.pdf)

## Implemented

- Responsive Next.js 15 SaaS interface deployed on Vercel
- FastAPI backend deployed on Railway with PostgreSQL readiness checks
- Registration, login, logout, protected workspaces, JWT access tokens, and refresh-token rotation
- Authenticated password change plus password-reset token flow in local/test environments, with production support recovery guidance until automated email delivery is connected
- Password reset token flow with dev-mode reset link and session revocation
- Owner admin allowlist support through Railway environment variables
- Owner-only admin summary for users, jobs, applications, generated materials, and subscriptions
- PDF and DOCX master-resume upload with persisted text extraction
- Resume section, skill, structured experience, education, and certification extraction
- Resume page next-step guidance from parsed resume to job matches, saved roles, and Review Application
- Live Adzuna job discovery for India with keyword search and attribution
- Live Remotive remote-job discovery with respectful short-lived caching and attribution
- Direct role and location search on the Jobs page
- Persisted job-discovery preferences for role keywords, location, and remote-only filtering
- Explainable resume-aware ranking with configurable scoring weights
- Recommendation explanations showing matched skills, ATS readiness, missing skills, and seniority fit
- Jobs page filters for high-fit roles, provider source, and remote-only results
- Distinct ATS-readiness scoring with keyword, section, formatting, and parse-readiness breakdowns
- ATS keyword fallback that extracts important skills and job terms from descriptions when provider data is sparse
- Persisted `80+` ATS review queue with explicit approve or dismiss controls
- Duplicate-application prevention and an assisted-application readiness checklist with manual final submission
- Dry-run automation adapter registry for LinkedIn, Naukri, Indeed, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, and generic career pages
- Application-level dry-run plans with per-site capability flags and a hard stop before final submit
- Tracked assisted-application dry-run records with blocked/ready status, warnings, next actions, and audit timeline events
- Queued material-preparation run tracking with visible status, attempts, results, failed-run retry controls, and timeline events
- Review Application workflow with job details, match/ATS scores, tailored resume version, cover letter preview, extracted fields, missing fields, warnings, and manual review confirmation
- Extension autofill is gated behind Review Application confirmation and fills only approved fields
- Extension form-inspection and autofill failures are logged to the application timeline with manual fallback guidance
- Extension field detection uses ARIA-linked labels, nearby question text, and common employer-form data attributes
- LinkedIn extraction uses scoped job-detail selectors, supports direct and recommended-job URLs, shows selector diagnostics, and blocks noisy page-body captures
- Site-aware extension capture for LinkedIn, Indeed, Naukri, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Jobvite, iCIMS, BambooHR, Workable, and generic career pages
- Guided application workflow for approve, prepare, download, employer-page review, and applied-date tracking
- Saved-job deep links from recommendations into the exact application workflow
- Persisted saved-job state in recommendations and manual capture handoff
- Saved jobs, application statuses, dashboard metrics, and application analytics
- Active and archived application views so rejected or withdrawn roles stay out of the working pipeline without losing history
- Dashboard activity log for resume upload/parsing, job scoring, and captured-job audit events
- Learning-system MVP with missing-skill recommendations from matched and approved roles
- Application notes and visible activity timeline
- Explicit audit events for generated resume, generated cover letter, review confirmation, autofill approval, upload assistance, and applied status
- Application date tracking when a role is marked applied
- Interview-round scheduling inside the application workspace
- Interview rescheduling, preparation notes, and removal
- Gemini-enhanced evidence-grounded drafts with a deterministic fallback
- Tailored-resume version history
- Editable tailored-resume workspace for summary, skills, and experience text
- Authenticated DOCX and PDF downloads for tailored resume versions
- Authenticated TXT downloads for persisted cover letters
- Editable cover-letter workspace with authenticated save and download
- Persisted subscription foundation with free-tier status and owner bypass
- In-app Settings privacy guidance with support path for data deletion requests
- Authenticated account data export from Settings without exposing password hashes, tokens, or payment credentials
- Dashboard activity timeline entry for account data exports
- Resume-aware Jobs empty states for upload, broader search, and manual job paste recovery
- Editable application profile fields used by Review Application and assisted autofill
- Clean Applications page review/material labels without encoding artifacts
- Clean extension autofill preview labels and extension version bump for reload clarity
- Dashboard launch checklist for resume, profile, match, application, preparation, and review readiness
- Explicit confirmation before marking an application as applied
- API guard requiring manual-submission confirmation before applied status
- Payment-review pages with concrete founder/location/support details
- Release-process docs now show QA/STAGE as paused while MVP work ships directly to `prod`
- Server-side validation for application-profile URLs used by review/autofill
- Settings shows API validation details for application-profile save errors
- Multi-provider aggregation boundary with deduplication, partial-failure resilience, and provider health reporting
- Manual career-page job capture with resume-aware scoring and tracker integration
- Unpacked Chrome extension MVP with one-time pairing and review-before-send job capture
- Extension API URL setting so the browser helper can be repointed when the backend domain changes
- Extension host permissions scoped to Railway subdomains for backend URL changes
- Local extension form inspector and review-gated autofill for common employer application fields, including approved-field audit logging
- Conservative autofill handling for select/dropdown fields while skipping hidden, disabled, read-only, checkbox, radio, and empty-value controls
- Extension tailored-resume PDF/DOCX download and manual-upload-required status for employer resume upload fields
- Greenhouse, Lever, LinkedIn, Indeed, Naukri, Workday, Ashby, SmartRecruiters, and generic career-page extractors
- Extension capture-readiness diagnostics with re-extract support before sending
- Public About, Pricing, Terms, Privacy, Refund/Cancellation, Shipping/Delivery, and Contact pages for SaaS/payment-gateway review

## Current Limitations

- Adzuna and Remotive are connected; deeper direct company-career-page job-provider integrations remain future work.
- Resume parsing is deterministic and requires user review.
- Gemini enhancement depends on configured API quota; deterministic grounded drafts remain available as a fallback.
- Automatic final submission remains intentionally deferred. Assisted autofill is review-gated and manual-submit only.
- Payment checkout and webhook processing are not connected yet.

## Architecture

```text
Vercel
  Next.js web app
      |
      v
Railway
  FastAPI API
      |
      +--> PostgreSQL
      |
      +--> Adzuna Jobs API
      |
      +--> Remotive Remote Jobs API
```

The backend follows clean-architecture boundaries with domain entities, application services, provider adapters, SQLAlchemy persistence, and FastAPI presentation routes.

## Local Development

```bash
docker compose up --build
```

Or run the apps directly:

```bash
cd apps/api
python -m pip install -r requirements.txt
alembic -c alembic.ini upgrade head
uvicorn app.main:app --reload
```

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000`. API documentation is available at `http://localhost:8000/docs`.

## Deployment

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel and Railway configuration. Keep secrets in Railway variables, never in Git.

## Release Process

For the current MVP push, changes are going directly to `prod` after local tests to save time. The `QA -> STAGE -> main` process is documented in [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md) and can be re-enabled later if traffic or team size requires stricter promotion gates.

## Next Changes

1. Continue reliability and safety hardening for assisted application actions
2. Add more employer-site-specific field selectors as real users report gaps
3. Add deeper extension UX polish after live usage feedback

## Chrome Extension MVP

Load the unpacked extension from [`apps/extension`](apps/extension) and follow its [local installation guide](apps/extension/README.md). The extension uses one-time pairing codes from Apply Wise Settings and receives a scoped token for capture, autofill planning, and assisted-application audit events.
