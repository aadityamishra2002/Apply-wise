# Apply Wise Release Process

This repository now uses three long-lived branches:

| Branch | Purpose | User access |
|---|---|---|
| `main` | Production, stable user-facing release | Real users only |
| `STAGE` | Production-like validation before release | Internal only |
| `QA` | Active development and first test pass | Internal only |

Current stable baseline:

```text
61223815398bdb1435e676a39e98b6852ff1017b
```

`QA` and `STAGE` were created from the same commit as `main`, so all three branches started identical.

## Required Promotion Flow

All future work must move in this order:

```text
feature work -> QA -> STAGE -> main
```

Rules:

1. Do not commit feature work directly to `main`.
2. Start changes from `QA`.
3. Test `QA`.
4. Merge `QA` into `STAGE`.
5. Test `STAGE`.
6. Merge `STAGE` into `main` only when ready for users.
7. Keep `main` deployable at all times.

## Recommended Git Commands

Start work:

```bash
git switch QA
git pull origin QA
```

After QA is tested:

```bash
git switch STAGE
git pull origin STAGE
git merge QA --no-ff
git push origin STAGE
```

After STAGE is tested:

```bash
git switch main
git pull origin main
git merge STAGE --no-ff
git push origin main
```

If production needs an emergency fix, create it from `main`, ship it, then merge `main` back into `STAGE` and `QA`.

## Deployment Environments

For real isolation, QA and STAGE should not share the production backend or production database.

Create three deployment environments:

| Environment | Frontend | API | Database |
|---|---|---|---|
| Production | Vercel production from `main` | Railway production API from `main` | Production Postgres |
| Stage | Vercel project/deployment from `STAGE` | Railway stage API from `STAGE` | Stage Postgres |
| QA | Vercel project/deployment from `QA` | Railway QA API from `QA` | QA Postgres |

This prevents QA or STAGE testing from changing real user accounts, resumes, jobs, applications, subscriptions, or generated materials.

## Environment Rules

Each backend environment needs its own:

- `DATABASE_URL`
- `APP_SECRET_KEY`
- `CORS_ORIGINS`
- `ALLOWED_HOSTS`
- `ADMIN_EMAILS`
- Provider keys such as `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, and `GEMINI_API_KEY`

Each frontend environment needs its own:

- `NEXT_PUBLIC_API_URL`

Use separate domains:

```text
Production web -> Production API
Stage web      -> Stage API
QA web         -> QA API
```

Never point QA or STAGE at the production database.

## Railway Setup

Recommended setup:

1. Keep the current Railway project as production.
2. Create a new Railway project or environment for `STAGE`.
3. Create a new Railway project or environment for `QA`.
4. Add a separate Postgres service for each.
5. Add a separate API service for each, rooted at `apps/api`.
6. Configure each service to deploy from the matching branch:
   - QA service: `QA`
   - Stage service: `STAGE`
   - Production service: `main`
7. Set each environment's variables independently.

The API already runs Alembic migrations before deploy through `apps/api/railway.json`.

## Vercel Setup

Recommended setup:

1. Keep the current Vercel production project mapped to `main`.
2. Create one Vercel project for QA, mapped to `QA`.
3. Create one Vercel project for STAGE, mapped to `STAGE`.
4. Set root directory to `apps/web` for all three.
5. Set `NEXT_PUBLIC_API_URL` to the matching Railway API URL.

Alternative: use one Vercel project with preview deployments, but separate projects are simpler and harder to misconfigure.

## Release Checklist

Before promoting QA to STAGE:

- Backend tests pass.
- Frontend production build passes.
- Resume upload works.
- Job search works.
- Save job and application workflow works.
- Password reset flow works in the target environment.

Before promoting STAGE to main:

- Repeat the QA checklist.
- Confirm STAGE uses the STAGE database.
- Confirm production variables were not changed.
- Confirm README and product status docs are updated.

## Current Branch State

At setup time:

```text
main  = 61223815398bdb1435e676a39e98b6852ff1017b
QA    = 61223815398bdb1435e676a39e98b6852ff1017b
STAGE = 61223815398bdb1435e676a39e98b6852ff1017b
```
