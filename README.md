# AI Job Application Copilot

Production-minded MVP for a web SaaS that helps job seekers discover roles, understand fit, tailor application materials, and track their search.

## What is implemented

- Responsive Next.js marketing page and authenticated-app prototype
- Dashboard, ranked job search, resume workspace, and application board
- FastAPI health, dashboard, job search, and resume-analysis endpoints
- Database-backed registration, login, logout, protected profile, and refresh-token rotation
- Argon2id password hashing and HTTP-only refresh-token cookies
- Frontend session refresh, private workspace route gating, and logout
- Alembic migration support for PostgreSQL with SQLite-compatible local verification
- Configurable deterministic job matching with a mock provider
- SQLAlchemy schema foundation for the core product entities
- Docker Compose services for web, API, PostgreSQL, and Redis
- Production Docker images, Railway config as code, Vercel config, and deployment readiness probes

## Local development

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

## Private beta deployment

The repository is prepared for a Vercel frontend and Railway API deployment. Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the required monorepo settings, secrets, and smoke checks.

## Next implementation slice

Add resume file uploads, PDF/DOCX parsing, persistent job repositories, and the background worker foundation.
