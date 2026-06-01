# MVP Implementation Notes

The repository starts as a modular monolith. The web app is the first distribution surface because it is shareable, responsive, and simpler to onboard than a browser extension.

## Vertical slice

1. Marketing page and onboarding entry point
2. Dashboard with actionable metrics
3. Mock-provider job discovery and explainable matching
4. Resume workspace with parse-preview UX
5. Application pipeline board

## Boundary rules

- Domain scoring remains independent from FastAPI and SQLAlchemy.
- Provider integrations normalize results behind a provider interface.
- Generated artifacts will remain immutable and tied to evidence from a master resume.
- PostgreSQL models are present, but API handlers use an in-memory provider until repository migrations land.
- Browser automation remains deferred until explicit consent and provider-policy controls exist.

## Identity foundation

- Users are persisted through SQLAlchemy repositories behind domain protocols.
- Passwords are hashed with Argon2id.
- Access JWTs expire after 15 minutes by default.
- Refresh tokens are opaque, stored only as hashes, rotated after use, and delivered to the web client through HTTP-only cookies.
- Reusing a rotated refresh token revokes its active token family.
- Alembic manages schema upgrades before the container starts the API.

## Deployment foundation

- Vercel serves the Next.js frontend from `apps/web`.
- Railway builds the API from `apps/api`, runs Alembic as a pre-deploy command, and checks PostgreSQL readiness before promoting a deployment.
- Production refresh cookies use `Secure`, `HttpOnly`, and `SameSite=None` for the Vercel-to-Railway browser flow.
- Railway's standard PostgreSQL URL is normalized to SQLAlchemy's async driver URL at the configuration boundary.
- The private workspace shell refreshes an existing session and redirects anonymous visitors to login.

## Resume foundation

- Authenticated users can upload a PDF or DOCX master resume up to 10 MB.
- PyMuPDF and python-docx extract text synchronously for the first usable slice.
- The active extracted resume, detected sections, and recognized skills are persisted in PostgreSQL.
- Uploading a replacement deactivates the previous master resume without deleting its historical evidence.
- Raw file bytes are intentionally not retained by the API container. S3-compatible object storage is required before raw-file download and broader rollout.
- Structured experience extraction, profile editing, and background parsing remain the next resume refinements.
