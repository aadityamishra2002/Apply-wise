# Private Beta Deployment

The fastest production path is:

- Vercel for the Next.js frontend
- Railway for the FastAPI API
- Railway PostgreSQL for durable application data
- Railway Redis for the upcoming worker and caching slice

The frontend and API deploy separately from the same GitHub monorepo.

## 1. Deploy The API On Railway

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
```

When you add a custom API domain, append its hostname to `ALLOWED_HOSTS`.

## 2. Deploy The Frontend On Vercel

1. Import the same GitHub repository into Vercel.
2. Set the project root directory to `apps/web`.
3. Keep the detected Next.js build settings.
4. Add the production variable below.
5. Deploy the project.

```dotenv
NEXT_PUBLIC_API_URL=https://<your-railway-api-domain>/api/v1
```

After Vercel creates the final production domain, set Railway `CORS_ORIGINS` to that exact origin and redeploy the API. Add preview origins explicitly when a preview deployment needs to call the API.

## 3. Verify The Deployment

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

## 4. Production Notes

- Store secrets only in Railway or Vercel variables. Do not commit `.env` files.
- Railway PostgreSQL backups should be enabled before storing real user resumes.
- The current product is suitable for a controlled private beta. Resume uploads, persistent job workflows, and billing still need implementation before a public launch.
- The API accepts Railway's standard `postgresql://` URL and normalizes it to the async SQLAlchemy driver internally.
- Production refresh cookies use `Secure`, `HttpOnly`, and `SameSite=None` so Vercel can refresh sessions through the Railway API.

## Platform References

- [Railway FastAPI guide](https://docs.railway.com/guides/fastapi)
- [Railway monorepo guide](https://docs.railway.com/guides/monorepo)
- [Railway config as code](https://docs.railway.com/config-as-code/reference)
- [Railway healthchecks](https://docs.railway.com/reference/healthchecks)
- [Railway variables](https://docs.railway.com/variables)
- [Vercel monorepos](https://vercel.com/docs/monorepos/)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
