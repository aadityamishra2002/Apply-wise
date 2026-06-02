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
- Owner admin allowlist support through Railway environment variables
- PDF and DOCX master-resume upload with persisted text extraction
- Resume section, skill, and structured experience extraction
- Live Adzuna job discovery for India with keyword search and attribution
- Persisted job-discovery preferences for role keywords, location, and remote-only filtering
- Explainable resume-aware ranking with configurable scoring weights
- Saved jobs, application statuses, dashboard metrics, and application analytics
- Application notes and visible activity timeline
- Evidence-grounded cover-letter drafts and tailored-resume version history

## Current Limitations

- Job discovery currently uses Adzuna as the first live provider.
- Resume parsing is deterministic and requires user review.
- Application drafts are evidence-grounded templates; external AI-provider enhancement is not enabled yet.
- Automated job applications and browser autofill are intentionally deferred.
- Subscription billing is not connected yet.

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

1. Interview scheduling and interview-round tracking
2. AI-provider integration for stronger truthful tailoring
3. DOCX and PDF export for generated resume versions
4. Subscription plans and feature entitlements
5. Additional compliant job providers and provider health monitoring
