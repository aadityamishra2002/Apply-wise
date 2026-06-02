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
- Interview-round scheduling inside the application workspace
- Interview rescheduling, preparation notes, and removal
- Gemini-enhanced evidence-grounded drafts with a deterministic fallback
- Tailored-resume version history
- Authenticated DOCX and PDF downloads for tailored resume versions
- Persisted subscription foundation with free-tier status and owner bypass
- Multi-provider aggregation boundary with deduplication, partial-failure resilience, and provider health reporting

## Current Limitations

- Adzuna remains the first live provider; additional compliant provider adapters are not connected yet.
- Resume parsing is deterministic and requires user review.
- Gemini enhancement depends on configured API quota; deterministic grounded drafts remain available as a fallback.
- Automated job applications and browser autofill are intentionally deferred.
- Razorpay checkout and webhook processing are not connected yet.

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

1. Razorpay checkout, webhook verification, and paid-plan activation
2. Additional compliant job provider adapters
3. Browser-extension capture and assisted autofill design
