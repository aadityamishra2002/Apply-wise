# AI Job Application Copilot

Production-minded MVP for a web SaaS that helps job seekers discover roles, understand fit, tailor application materials, and track their search.

## What is implemented

- Responsive Next.js marketing page and authenticated-app prototype
- Dashboard, ranked job search, resume workspace, and application board
- FastAPI health, dashboard, job search, and resume-analysis endpoints
- Configurable deterministic job matching with a mock provider
- SQLAlchemy schema foundation for the core product entities
- Docker Compose services for web, API, PostgreSQL, and Redis

## Local development

```bash
docker compose up --build
```

Or run the apps directly:

```bash
cd apps/api
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3000`. API documentation is available at `http://localhost:8000/docs`.

## Next implementation slice

Add JWT authentication, Alembic migrations, persistent PostgreSQL repositories, file uploads, and the resume parsing worker.

