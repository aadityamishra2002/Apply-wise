# Apply Wise Developer Guide

## Last Reviewed

- Date: 2026-06-22
- Commit: 45d5e3a
- Version/release: Beta MVP, extension v0.3.3

## Purpose

This guide is the engineering source of truth for contributors. A new developer should be able to read this file, `FEATURE_MAP.md`, `TROUBLESHOOTING.md`, and `PRODUCT_STATUS.md` to understand where the major product features live and how to change them safely.

## Repository Map

| Area | Path | Purpose |
|---|---|---|
| Web app | `apps/web` | Next.js 15 user interface deployed on Vercel |
| API | `apps/api` | FastAPI backend deployed on Railway |
| API routes | `apps/api/app/presentation/api_v1/router.py` | Main authenticated product API surface |
| Database models | `apps/api/app/infrastructure/db/models.py` | SQLAlchemy model definitions |
| Migrations | `apps/api/migrations/versions` | Alembic schema history |
| Extension | `apps/extension` | Unpacked Chrome/Brave extension for job capture and assisted workflows |
| Product docs | `docs` | Permanent project documentation and operational notes |

## Local Development

Run everything with Docker:

```bash
docker compose up --build
```

Or run services directly:

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

## Documentation Maintenance Rules

Documentation is part of the product. Any future PR, feature implementation, bug fix, architectural change, new API endpoint, database migration, extension update, or major UI workflow change must update the relevant documentation in the same change.

When a new feature is added, update:

- `docs/FEATURE_MAP.md`
- `docs/TROUBLESHOOTING.md`, if the feature adds a realistic failure mode or support path
- `docs/PRODUCT_STATUS.md`
- `README.md`, if the feature changes onboarding, architecture, deployment, or public product capabilities
- `docs/APPLY_WISE_PRODUCT_STATUS.pdf`, when `PRODUCT_STATUS.md` changes

When a new API endpoint is added, document:

- Endpoint path and method
- Authentication requirement
- Request format
- Response format
- Related frontend and backend files
- Database tables touched
- Expected tests

When a new extension feature is added, update:

- Extension architecture notes in this guide
- `apps/extension/README.md`
- `docs/TROUBLESHOOTING.md` debugging guide
- Common failure modes and manual recovery steps
- Extension version in `apps/extension/manifest.json` when users must reload the unpacked extension
- Extension regression or contract tests

When a new database migration is added, update:

- Database map in this guide
- Table ownership section in this guide
- `docs/FEATURE_MAP.md` rows for affected features
- `docs/PRODUCT_STATUS.md`
- Any account export, privacy, or deletion notes if user data shape changes

Keep the `Last Reviewed` block at the top of `FEATURE_MAP.md`, `DEVELOPER_GUIDE.md`, and `TROUBLESHOOTING.md` current whenever those files are touched.

## Repository Checklist

Before closing any future development task, verify:

- Feature implemented
- Tests passing
- Documentation updated
- Product status updated when behavior changed
- User guide updated when user steps changed
- Extension version bumped when users must reload the extension
- No secrets or real user data committed
- Final submission remains manual for application workflows

## How To Onboard A New Developer In 30 Minutes

1. Read `README.md` for product overview, live URLs, and current limitations.
2. Read `docs/PRODUCT_STATUS.md` for the latest shipped capability list and known limitations.
3. Read `docs/FEATURE_MAP.md` to find where each major feature lives in the repo.
4. Read this guide for local setup, documentation rules, API ownership, database ownership, and extension architecture.
5. Read `docs/TROUBLESHOOTING.md` for common local, production, and extension failures.
6. Start the stack with Docker or run API/web directly.
7. Run the core checks listed below.
8. Make one small read-only API call or open the local web app to confirm the environment works.

Core checks:

```powershell
$env:PYTHONPATH='apps/api'; .\.venv\Scripts\python.exe -m pytest apps/api/tests -q
cd apps\web
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\node_modules\typescript\bin\tsc' --noEmit
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\node_modules\next\dist\bin\next' build
cd ..\..
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check apps\extension\popup.js
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' apps\extension\tests\extraction-regression.test.js
& 'C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' apps\extension\tests\manifest-popup-contract.test.js
```

## API Ownership

Most product routes live in `apps/api/app/presentation/api_v1/router.py`. Keep route handlers thin where practical and prefer application services for reusable logic.

| API area | Primary files | Main tables touched |
|---|---|---|
| Auth and sessions | `apps/api/app/presentation/api_v1/auth.py`, identity services/repositories | `users`, `refresh_tokens`, `password_reset_tokens` |
| Resume upload/profile | `router.py`, `app/application/resumes/service.py` | `master_resumes`, `resume_templates`, `resume_skills`, `resume_experiences`, `resume_education`, `resume_certifications`, `resume_projects` |
| Resume templates/export | `router.py`, `app/application/exports/service.py` | `resume_templates`, `resume_versions`, `activity_logs` |
| Job search/import/capture | `router.py`, job providers, matching services | `jobs`, `job_matches`, `job_preferences`, `applications`, `activity_logs` |
| ATS/matching | `app/application/jobs`, `router.py` | `job_matches`, `activity_logs` |
| Resume and cover generation | `app/application/tailoring`, `router.py`, `apps/web/src/app/applications/[id]/prepare/page.tsx` | `resume_versions`, `cover_letters`, `applications`, `application_events`, `activity_logs` |
| Application tracking | `router.py`, application helpers | `applications`, `application_events`, `interviews`, `automation_runs`, `background_jobs` |
| Settings/profile/export | `router.py` | `user_profiles`, `subscriptions`, user-owned workspace tables |
| Extension integration | `router.py`, extension popup scripts | `extension_pairing_codes`, `jobs`, `job_matches`, `applications`, `application_events`, `activity_logs` |

## Database Map And Table Ownership

| Table family | Owner area | Notes |
|---|---|---|
| `users`, `refresh_tokens`, `password_reset_tokens` | Identity/auth | Never expose hashes or token values in account export |
| `master_resumes`, resume child tables | Resume system | User-owned resume evidence for scoring and generation |
| `resume_templates` | Resume template system | Stores user-uploaded DOCX templates and DOCX master-resume layout snapshots as binary data plus extracted placeholder metadata; placeholders may be empty for plain-DOCX section replacement; never expose raw bytes in account export |
| `jobs`, `job_matches`, `job_preferences` | Job ingestion and matching | Jobs may come from providers, manual paste, URL import, or extension capture |
| `resume_versions`, `cover_letters` | AI preparation | Generated artifacts must stay grounded in stored resume evidence; resume versions may reference a template and must fall back safely if that template is deleted |
| `applications`, `application_events`, `interviews` | Application tracking | Final submission stays manual; status changes must be auditable |
| `extension_pairing_codes` | Extension pairing | Pairing codes are one-time and expire quickly |
| `automation_runs`, `background_jobs` | Assisted workflow tracking | Current automation is dry-run/manual-submit only |
| `activity_logs` | User-visible audit trail | Log important user-visible workflow events |
| `subscriptions` | Billing foundation | Payment checkout is deferred until payment account approval |

When changing a table, update migrations, tests, account export behavior if relevant, and the feature map.

## Extension Architecture

The extension lives in `apps/extension` and runs as an unpacked Manifest V3 Chrome/Brave extension.

- `manifest.json` defines version, activeTab/storage/scripting permissions, and host permissions.
- `popup.html` is the user-facing capture/autofill UI.
- `popup.js` injects extraction logic into the active tab, validates captured fields, sends reviewed jobs to the API, loads autofill plans, and logs assisted workflow events.
- `apps/extension/tests/extraction-regression.test.js` protects site extraction behavior.
- `apps/extension/tests/manifest-popup-contract.test.js` protects the manifest/popup contract.

Safety rules:

- Never submit final applications automatically.
- Keep capture editable so users can fix missing title/company/description fields.
- Keep debug reports copyable.
- Bump extension version when user reload is required.
- Update common failure modes in `TROUBLESHOOTING.md` whenever a new extension path is added.

## Release Practice

Current MVP practice is direct-to-main after local validation. The paused QA/STAGE process is documented in `docs/RELEASE_PROCESS.md` and can be re-enabled later.

For each development slice:

1. Implement the smallest useful production change.
2. Run impacted backend, frontend, and extension checks.
3. Update documentation.
4. Commit with a clear message.
5. Push to `main`.
6. Verify live deployment when the change affects deployed behavior.
