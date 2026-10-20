# Apply Wise Deployment

## Selected free demo path

The selected no-cost setup is **Vercel + Render Free + Supabase Free + Upstash Redis Free**. It is intended for a personal demo and limited feedback, not production use with real users or sensitive resume data. The Supabase database and Upstash Redis instance are provisioned. Render has created the API service, but its first deploy failed during startup; the published frontend still points at the unavailable Railway API.

The repository includes [`render.yaml`](../render.yaml), which configures the FastAPI web service, startup migrations, health check, and an in-process preparation worker. Render Free does not offer a separate free background-worker service, so the API and worker share one web process in this demo configuration.

### Setup

1. Create a [Supabase](https://supabase.com/dashboard) project in [Southeast Asia (Singapore)](https://supabase.com/docs/guides/platform/regions) to keep it near the Render service. From **Connect**, copy the PostgreSQL [**Session pooler** connection string](https://supabase.com/docs/guides/database/connecting-to-postgres) (port `5432`) for a persistent backend connection. Replace the password placeholder, URL-encode reserved password characters, and keep the complete URI private.
2. Create a Redis database in [Upstash](https://console.upstash.com/) in Singapore if available. Copy its `rediss://` connection string; do not commit it.
3. In [Render](https://dashboard.render.com/), create a Blueprint from this repository and select the branch containing `render.yaml`. The blueprint creates `apply-wise-api` in Singapore on the Free plan.
4. Set the Render variables:
   - `DATABASE_URL`: the Supabase Session pooler URI.
   - `REDIS_URL`: the Upstash `rediss://` URI.
   - `ALLOWED_HOSTS`: the exact hostname Render assigned, without `https://` or a path. If the hostname differs from `apply-wise-api.onrender.com`, replace the blueprint value.
   - Keep `APP_ENV=production`, the generated `APP_SECRET_KEY`, `RUN_IN_PROCESS_WORKER=true`, `CORS_ORIGINS=https://apply-wise-1.vercel.app`, and `FRONTEND_BASE_URL=https://apply-wise-1.vercel.app`. Change the frontend values if its production domain differs.
5. Deploy. The container runs `alembic upgrade head` before Uvicorn starts. The readiness check at `/api/v1/health/ready` requires both PostgreSQL and Redis. Startup logs should include `worker_started` when the in-process queue worker begins.
6. In the Vercel project, set the **Production** variable `NEXT_PUBLIC_API_URL` to `https://<render-hostname>/api/v1`, then redeploy the frontend. Keep the API URL free of credentials, query parameters, and a trailing path after `/api/v1`.
7. Check `https://<render-hostname>/api/v1/health` and `/api/v1/health/ready`, then try registration, login, resume upload, and one preparation job from the live site.

### Free-tier limits to plan around

- Render sleeps after 15 minutes without incoming traffic and can take about a minute to wake. Free instances can restart, have ephemeral filesystems, and do not support a separate free background worker. A queued preparation job may wait until the API wakes; an interrupted job can be retried after its lease expires. See [Render Free services](https://render.com/docs/free).
- Vercel's free Hobby plan is restricted to personal, non-commercial use. If Apply Wise is operated as a business or for commercial purposes, keep this route only if the Vercel plan permits that use; otherwise the frontend also needs a suitable host/plan. See [Vercel Hobby plan terms](https://vercel.com/docs/plans/hobby).
- Supabase Free currently includes 500 MB per project and can pause projects with low activity over seven days. Free projects do not have automatic backups; export data before relying on it. See [Supabase plan details](https://supabase.com/docs/guides/platform/billing-on-supabase), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), and [database backups](https://supabase.com/docs/guides/platform/backups).
- Upstash Redis Free currently includes 256 MB and 500,000 commands per month. Rate limiting depends on Redis, so reaching the quota or an outage can make API requests unavailable. See [Upstash Redis pricing](https://upstash.com/pricing/redis).
- Keep this setup for a demo. Before real-user use, move to services with dependable uptime, backups, monitoring, and a separately managed worker; verify data recovery and email delivery.

## Production path (Railway)

The fuller production topology is:

- Vercel for the Next.js frontend
- Railway for the FastAPI API
- Railway PostgreSQL for durable application data
- Railway Redis for shared rate limits and worker support
- A separate Railway worker service for durable application-material preparation

The frontend and API deploy separately from the same GitHub monorepo.

### 1. Deploy The API On Railway

1. Create a Railway project from the GitHub repository.
2. Add a PostgreSQL database service.
3. Add a Redis database service.
4. Create an API service from the same GitHub repository.
5. Set the API service root directory to `/apps/api`.
6. Set the API service config file path to `/apps/api/railway.json`.
7. Add a reference variable named `DATABASE_URL` using `${{Postgres.DATABASE_URL}}`.
8. Add a reference variable named `REDIS_URL` using the Redis service URL.
9. Generate a public Railway domain for the API service.
10. Add the production variables below and deploy the staged changes.

Railway automatically injects `PORT`. The API Docker image listens on that port. The config file runs Alembic before deployment and waits for `/api/v1/health/ready` to confirm that PostgreSQL is reachable.

### Railway API Variables

```dotenv
APP_ENV=production
APP_SECRET_KEY=<generate-a-random-secret-with-at-least-32-characters>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=<add-the-reference-variable-from-your-redis-service>
CORS_ORIGINS=https://<your-vercel-production-domain>
ALLOWED_HOSTS=healthcheck.railway.app,*.up.railway.app
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
REFRESH_COOKIE_NAME=jobcopilot_refresh
JWT_ISSUER=job-application-copilot
ENABLE_API_DOCS=false
LOG_LEVEL=INFO
LOG_FORMAT=json
ADMIN_EMAILS=<comma-separated-owner-emails>
```

When you add a custom API domain, append its hostname to `ALLOWED_HOSTS`.

### 2. Deploy The Worker On Railway

The worker runs queued application-material preparation outside the API request process.

1. Create a second service in each Railway environment from the same repository.
2. Set the root directory to `/apps/api` and config file path to `/apps/api/railway.worker.json`.
3. Copy that environment's `DATABASE_URL`, `APP_ENV`, `APP_SECRET_KEY`, and generation-provider settings from its API service, including `GEMINI_API_KEY` when enabled.
4. Do not generate a public domain for the worker.
5. Deploy and confirm the Railway logs contain `worker_started`; claimed jobs are logged as `job_claimed`.

The worker uses PostgreSQL to claim queued jobs with row locking and a heartbeat lease, so multiple worker instances can safely compete for work. Monitor worker restarts and failed preparation jobs in Railway.

### 3. Deploy The Frontend On Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `apps/web`.
3. Keep the detected Next.js build settings.
4. Add the production variable below.
5. Deploy the project.

```dotenv
NEXT_PUBLIC_API_URL=https://<your-railway-api-domain>/api/v1
```

After Vercel creates the final production domain, set Railway `CORS_ORIGINS` to that exact origin and redeploy the API. Add preview origins explicitly when a preview deployment needs to call the API.

### 4. Verify The Deployment

Check the API first:

```bash
curl https://<your-railway-api-domain>/api/v1/health
curl https://<your-railway-api-domain>/api/v1/health/ready
```

Then open the Vercel URL and verify:

1. Registration creates an account and opens the dashboard.
2. Logging out returns to the login page.
3. Logging in opens the dashboard.
4. Opening `/dashboard` in a private browser window redirects to `/login`.
5. Refreshing the dashboard preserves the signed-in session.

### 5. Production Notes

- Store secrets only in provider environment variables. Do not commit `.env` files.
- Add owner email addresses to Railway's `ADMIN_EMAILS` variable. Allowlisted accounts receive the persisted `admin` role when they register or next authenticate.
- Railway PostgreSQL backups should be enabled before storing real user resumes.
- Resume uploads and persisted job workflows are implemented in the application. Production readiness still depends on restoring the API, provisioning Redis and the worker, verifying backups and email delivery, and completing the release gates below.
- The API accepts Railway's standard `postgresql://` URL and normalizes it to the async SQLAlchemy driver internally.
- Production refresh cookies use `Secure`, `HttpOnly`, and `SameSite=None` so Vercel can refresh sessions through the Railway API.
- Keep Railway PostgreSQL and Redis private to the project. `REDIS_URL` is required for API rate limits; the API readiness endpoint checks both PostgreSQL and Redis.
- Enable automated PostgreSQL backups and perform a restore rehearsal before real user data is stored. Confirm the backup retention and recovery process in Railway.
- Configure a production SMTP provider if users need password reset email. Keep SMTP credentials only in Railway variables.
- Configure GitHub branch protection and required CI checks for `main`, `STAGE`, and `QA`; the repository release guide describes the promotion order but cannot enforce these settings by itself.
- The currently configured production Railway hostname returned `404 Application not found` during the October 20, 2026 audit. Restore that service or use the selected Render demo path, then update Vercel's production `NEXT_PUBLIC_API_URL` to the working HTTPS URL ending in `/api/v1` and redeploy.
- Payment checkout, subscription billing, and webhook handling are not implemented. Do not advertise paid plans as purchasable until a provider integration is completed.

## Platform References

- [Railway FastAPI guide](https://docs.railway.com/guides/fastapi)
- [Railway monorepo guide](https://docs.railway.com/guides/monorepo)
- [Railway config as code](https://docs.railway.com/config-as-code/reference)
- [Railway healthchecks](https://docs.railway.com/reference/healthchecks)
- [Railway variables](https://docs.railway.com/variables)
- [Vercel monorepos](https://vercel.com/docs/monorepos/)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
