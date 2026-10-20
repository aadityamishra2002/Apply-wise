# Apply Wise Release Process

Release flow: promote changes through `QA -> STAGE -> main`. Configure branch protection and required checks in GitHub before relying on this as an enforced gate. The settings listed here are recommendations until verified in GitHub.

The earlier release plan used three long-lived branches:

| Branch | Purpose | User access |
|---|---|---|
| `main` | Production, stable user-facing release | Real users only |
| `STAGE` | Production-like validation before release | Internal only |
| `QA` | Active development and first test pass | Internal only |

Initial stable baseline recorded June 22, 2026:

```text
61223815398bdb1435e676a39e98b6852ff1017b
```

`QA` and `STAGE` were created from the same commit as `main`, so all three branches started identical.

## Promotion Flow

Changes move in this order:

```text
feature work -> QA -> STAGE -> main
```

Release rules:

1. Do not commit feature work directly to `main`.
2. Start changes from `QA`.
3. Test `QA`.
4. Merge `QA` into `STAGE`.
5. Test `STAGE`.
6. Merge `STAGE` into `main` only when ready for users.
7. Keep `main` deployable at all times.

Keep `main` deployable and update README/product status docs with each meaningful release. Merge only after the target environment's release checklist passes.

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
- `REDIS_URL` for shared API rate limits
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

## Recorded Vercel Status

Vercel was connected to the repository and had produced these branch preview deployments when this was last documented on June 22, 2026. Confirm the project settings and current domains in Vercel before release:

| Branch | Current Vercel URL |
|---|---|
| `QA` | `https://apply-wise-git-qa-aadityamishra10s-projects.vercel.app` |
| `STAGE` | `https://apply-wise-git-stage-aadityamishra10s-projects.vercel.app` |
| `main` | `https://apply-wise-1.vercel.app` |

The last recorded Vercel setup used `NEXT_PUBLIC_API_URL` for Production and Preview. Until branch-specific API URLs are verified, QA/STAGE preview deployments may call the production API. Do not use QA/STAGE for data-changing tests until their own backend URLs are configured and verified.

## Recorded Railway Status

Railway was recorded as having three environments in one project on June 22, 2026. Verify current services, domains, databases, and variables in Railway:

| Environment | Branch | API URL | Environment ID | Status |
|---|---|---|---|---|
| Production | `main` | `https://jobsearchautomation-production.up.railway.app` | `5848c9b5-b9c3-4239-ba6d-a1e16863b296` | Returned `404 Application not found` on October 20, 2026; restore the service or update Vercel to the current API domain |
| QA | `QA` | `https://applywise-qa.up.railway.app` | `28dfee88-404b-4628-bec4-3d65af5d0038` | Created, branch-connected, variables updated |
| STAGE | `STAGE` | `https://applywise-stage.up.railway.app` | `d36a4ca2-383a-4d9f-8a4d-45bae9924b20` | Created, branch-connected, variables updated |

QA and STAGE were duplicated from production with separate Postgres services. These recorded deployment details need confirmation in Railway before use. Confirm `DATABASE_URL` still points to the matching environment's Postgres before running destructive tests.

## Recorded Railway Setup

Last documented setup:

1. The Railway project was reported as production.
2. Railway environments exist for `QA` and `STAGE`.
3. Each environment includes an API service, Postgres service, and its own Redis service.
4. Each API service is rooted at `apps/api`.
5. Each service deploys from the matching branch:
   - QA service: `QA`
   - Stage service: `STAGE`
   - Production service: `main`
6. Set each environment's variables independently:
   - QA: `APP_ENV=qa`, `ALLOWED_HOSTS=applywise-qa.up.railway.app,healthcheck.railway.app`, `CORS_ORIGINS=https://apply-wise-git-qa-aadityamishra10s-projects.vercel.app`
   - STAGE: `APP_ENV=stage`, `ALLOWED_HOSTS=applywise-stage.up.railway.app,healthcheck.railway.app`, `CORS_ORIGINS=https://apply-wise-git-stage-aadityamishra10s-projects.vercel.app`

The API already runs Alembic migrations before deploy through `apps/api/railway.json`.

## Vercel Setup

Recommended setup:

1. Keep the current Vercel production project mapped to `main`.
2. Create one Vercel project for QA, mapped to `QA`.
3. Create one Vercel project for STAGE, mapped to `STAGE`.
4. Set root directory to `apps/web` for all three.
5. Set `NEXT_PUBLIC_API_URL` to the matching Railway API URL.

Deploy a separate Railway worker in each environment, rooted at `/apps/api`, configured with `/apps/api/railway.worker.json` and the same database, application secrets, and generation-provider settings as that environment's API. Do not assign the worker a public domain. Set `REDIS_URL` for each API environment.

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

At the initial environment setup on June 22, 2026:

```text
main  = 61223815398bdb1435e676a39e98b6852ff1017b
QA    = 61223815398bdb1435e676a39e98b6852ff1017b
STAGE = 61223815398bdb1435e676a39e98b6852ff1017b
```
