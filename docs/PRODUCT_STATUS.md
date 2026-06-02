# Apply Wise Product Status

**Last updated:** June 2, 2026  
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
| Job source | Adzuna API | Live India job listings with attribution |
| Authentication | JWT access tokens and refresh-token rotation | Protected user workspaces |

## Implemented User Journey

1. Register or log in.
2. Upload a PDF or DOCX master resume.
3. Review extracted sections, recognized skills, and structured experience.
4. Search live Adzuna listings by role or keyword.
5. Review explainable profile-match scores and missing skills.
6. Save a role into the application tracker.
7. Prepare an evidence-grounded resume version and cover-letter draft.
8. Update application status and monitor dashboard metrics.
9. Review pipeline analytics and generated resume-version history.
10. Save role, location, and remote-only job-discovery preferences.
11. Add application notes and review visible timeline events.

## Truthfulness Rules

Generated application drafts use stored resume evidence only. The current implementation does not invent employers, skills, projects, responsibilities, or achievements. Every draft remains review-required before use.

## Security and Operations

- Passwords are hashed with Argon2id.
- Refresh tokens rotate and replay attempts revoke the token family.
- Refresh cookies are HTTP-only.
- Owner admin access is configured through an environment-variable allowlist.
- Production secrets remain in Railway variables and are not committed to Git.
- Railway exposes health and database-readiness probes.
- PostgreSQL schema changes use Alembic migrations.

## Current Limitations

- Adzuna is the only live job provider currently connected.
- Resume parsing uses deterministic heuristics and still needs user review.
- Tailored materials are stored evidence-grounded drafts, not LLM-enhanced documents yet.
- Resume DOCX and PDF export is not implemented yet.
- Interview rounds and scheduling need a fuller interface.
- Subscription billing and feature entitlements are not connected.
- Chrome-extension autofill and Playwright application automation remain future work.

## Next Delivery Slices

1. Add interview-round scheduling and interview notes.
2. Integrate an AI provider with strict evidence grounding and prompt guardrails.
3. Add generated resume DOCX and PDF exports.
4. Add subscription plans, owner bypass, and usage entitlements.
5. Add additional compliant job providers and provider health monitoring.
6. Design browser-extension capture and assisted autofill.

## Deployment Note

The product is live for public account registration. The Railway backend currently depends on the selected Railway plan and usage allowance. Check Railway usage regularly before the trial window ends.
