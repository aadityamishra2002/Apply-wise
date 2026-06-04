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
- Authenticated password change with refresh-session revocation
- Owner admin allowlist support through Railway environment variables
- PDF and DOCX master-resume upload with persisted text extraction
- Resume section, skill, structured experience, education, and certification extraction
- Live Adzuna job discovery for India with keyword search and attribution
- Live Remotive remote-job discovery with respectful short-lived caching and attribution
- Direct role and location search on the Jobs page
- Persisted job-discovery preferences for role keywords, location, and remote-only filtering
- Explainable resume-aware ranking with configurable scoring weights
- Recommendation explanations showing matched skills, ATS readiness, missing skills, and seniority fit
- Jobs page filters for high-fit roles, provider source, and remote-only results
- Distinct ATS-readiness scoring with keyword, section, formatting, and parse-readiness breakdowns
- Persisted `80+` ATS review queue with explicit approve or dismiss controls
- Duplicate-application prevention and an assisted-application readiness checklist with manual final submission
- Guided application workflow for approve, prepare, download, employer-page review, and applied-date tracking
- Saved-job deep links from recommendations into the exact application workflow
- Persisted saved-job state in recommendations and manual capture handoff
- Saved jobs, application statuses, dashboard metrics, and application analytics
- Learning-system MVP with missing-skill recommendations from matched and approved roles
- Application notes and visible activity timeline
- Application date tracking when a role is marked applied
- Interview-round scheduling inside the application workspace
- Interview rescheduling, preparation notes, and removal
- Gemini-enhanced evidence-grounded drafts with a deterministic fallback
- Tailored-resume version history
- Authenticated DOCX and PDF downloads for tailored resume versions
- Authenticated TXT downloads for persisted cover letters
- Persisted subscription foundation with free-tier status and owner bypass
- Multi-provider aggregation boundary with deduplication, partial-failure resilience, and provider health reporting
- Manual career-page job capture with resume-aware scoring and tracker integration
- Unpacked Chrome extension MVP with one-time pairing and review-before-send job capture
- Local extension form inspector for common employer application fields, without autofill or submission
- Greenhouse, Lever, and LinkedIn extension extractors with a generic career-page fallback
- Public Terms, Privacy, Refund Policy, Contact, and free-beta pricing pages

## Current Limitations

- Adzuna and Remotive are connected; LinkedIn, Indeed, Naukri, and company-career-page adapters are not connected yet.
- Resume parsing is deterministic and requires user review.
- Gemini enhancement depends on configured API quota; deterministic grounded drafts remain available as a fallback.
- Automatic submission and browser autofill remain intentionally deferred.
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

## Next Changes

1. Payment gateway checkout, webhook verification, and paid-plan activation
2. Additional compliant job provider adapters and deeper remote-role filtering
3. Site-specific extension extractors and assisted autofill design

## Chrome Extension MVP

Load the unpacked extension from [`apps/extension`](apps/extension) and follow its [local installation guide](apps/extension/README.md). The extension uses one-time pairing codes from Apply Wise Settings and receives a capture-only token.
