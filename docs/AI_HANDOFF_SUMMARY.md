# Apply Wise AI Handoff Summary

Last updated: 2026-06-21

## 1. Project Overview

Apply Wise is an AI-powered job application SaaS product. It helps users upload a master resume, parse structured profile data, capture/import jobs, calculate match and ATS scores, generate truthful tailored resumes and cover letters, track applications, and use a Chrome/Brave extension for job capture and assisted workflows.

Live product:

- Web: `https://apply-wise-1.vercel.app`
- API: `https://jobsearchautomation-production.up.railway.app/api/v1`
- Repo: `https://github.com/aadityamishra2002/Apply-wise`

## 2. Branch Workflow

Target production workflow:

```text
QA -> STAGE -> main
```

Current MVP practice:

- Work has recently been done directly on `main` to ship faster.
- QA/STAGE exist in documentation as the intended future promotion process.
- Do not assume QA/STAGE are active for every change unless the user explicitly says so.

## 3. Current Production And CI Status

Production:

- Vercel web app is live.
- Railway API health returns OK.
- Railway readiness confirms database connectivity.
- Railway config runs `alembic -c alembic.ini upgrade head` before deploy.

CI:

- Workflow: `.github/workflows/ci.yml`
- Job: `verify`
- CI runs backend tests, SQLite migration upgrade, web typecheck, web build, and extension validation.
- Recent CI failure was caused by SQLite not supporting direct foreign-key constraint alteration in migration `a3f2d9b7c6e1_add_resume_templates.py`.
- Fix committed locally: migration now uses Alembic `batch_alter_table` for `resume_versions.template_id`.
- Local checks after the fix passed:
  - API tests: 93 passed
  - SQLite `alembic upgrade head`: passed
  - SQLite `alembic downgrade -1`: passed
  - SQLite `alembic upgrade head`: passed
  - web typecheck: passed
  - web production build: passed
  - extension syntax/regression/contract checks: passed

## 4. Implemented Features

Core product:

- Registration/login/logout.
- JWT auth and refresh-token rotation.
- Password change and password reset flow.
- Admin allowlist/foundation.
- Resume upload for PDF/DOCX.
- Resume parsing for text, skills, experience, education, certifications, and projects.
- Resume profile editor and re-parse support.
- Live job search through Adzuna and Remotive.
- Manual job paste and public URL import.
- Chrome/Brave extension job capture.
- Job persistence and deduplication.
- Match scoring and ATS scoring.
- 80+ ATS review queue.
- Saved jobs and application tracking.
- Application statuses: saved, preparing, applied, interview, rejected, offer, withdrawn.
- Application notes, timeline events, and interview tracking.
- Tailored resume generation with Gemini when configured and deterministic fallback.
- Cover letter generation.
- Generated resume/cover letter previews, copy actions, and downloads.
- Account export and privacy guidance.
- Public compliance pages for Razorpay/payment-review readiness.

Resume template system:

- DOCX template upload.
- Built-in ATS-friendly fallback template.
- Active template selection.
- Rename/delete custom templates.
- Active template preview.
- Placeholder rendering for name, contact, summary, skills, experience, projects, education, certifications.
- Generated resume versions store `template_id`.
- DOCX export preserves template formatting where placeholders exist.
- PDF export contains all resume content and follows template section order, but does not exactly preserve the DOCX visual layout.

Extension:

- Manifest V3 Chrome/Brave extension.
- One-time pairing from Settings.
- Configurable API URL.
- LinkedIn extraction with selectors, meta tags, JSON-LD, visible text fallback, manual fallback, diagnostics, and copy debug report.
- Site-aware extraction for LinkedIn, Indeed, Naukri, Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Jobvite, iCIMS, BambooHR, Workable, and generic career pages.
- Form inspection and review-gated autofill foundations.
- Extension resume download/manual-upload guidance.
- Final submission remains manual.

## 5. Pending Features, Excluding Payments

Highest priority:

1. Assisted Apply human-in-the-loop flow.
2. Resume upload during assisted apply.
3. Real job-provider expansion and hardening.
4. Chrome extension integration hardening with more real-world site samples.
5. Playwright dry-run adapters for selected job sites.
6. Better production observability/log review access.
7. Exact PDF template fidelity if required.

Do not start payment/Razorpay checkout work yet.

## 6. Important Architecture Decisions

- Backend: FastAPI, Python 3.12, SQLAlchemy, Alembic.
- Frontend: Next.js 15, TypeScript, Tailwind CSS.
- Database: PostgreSQL in production; SQLite is used by tests and CI migration verification.
- Deployment: Vercel for web, Railway for API/Postgres.
- Clean architecture direction: presentation routes call application services and database models through scoped session usage.
- Generation safety:
  - Never fabricate skills, companies, projects, titles, dates, metrics, or experience.
  - Generated materials must stay grounded in uploaded resume/profile evidence.
- Final job application submission must stay manual.
- Extension capture/autofill must be user-reviewed and never auto-submit.
- Documentation is treated as source of truth and must be updated with feature changes.

## 7. Resume Template System Status

Status: implemented and production-smoked.

Verified:

- Upload DOCX template.
- Activate template.
- Preview active template.
- Generate tailored resume.
- DOCX download preserves uploaded template structure and placeholder formatting.
- PDF download works and contains generated resume content.
- `resume_versions.template_id` is persisted.
- Template routes are live in OpenAPI.
- CI migration issue was fixed with Alembic batch mode.

Known limitation:

- PDF export is not a pixel-perfect rendering of the DOCX template. It uses a clean PDF renderer with template section ordering.

Key migration:

- `apps/api/migrations/versions/a3f2d9b7c6e1_add_resume_templates.py`

## 8. Chrome Extension Status

Status: MVP working with known real-world brittleness.

What works:

- Pair extension.
- Capture job pages.
- LinkedIn extraction no longer falls back to hostname as company.
- Manual fallback lets user correct missing required fields.
- Send to Apply Wise persists captured jobs.
- Assisted autofill foundations exist and are gated behind review.

Known limitations:

- LinkedIn changes DOM often; debug report should be used when capture breaks.
- Employer form autofill needs ongoing site-specific hardening.
- Resume file upload during applications is mostly manual guidance, not full automated upload.
- Final submit is intentionally manual.

## 9. Known Limitations And Blockers

- Railway/Vercel platform logs are not accessible from this local environment unless the user signs in or provides CLI/auth access.
- Local Docker is not available in this environment.
- Exact live `alembic downgrade -1` should not be run against production because it can drop template data.
- PDF template export does not exactly preserve uploaded DOCX layout.
- Payment/Razorpay checkout remains deferred.
- SMTP provider should still be configured for production password reset email delivery.

## 10. Exact Next Recommended Task

Start Assisted Apply human-in-the-loop flow.

Recommended scope:

1. Inspect current Applications page, Review Application API, extension autofill plan, and application timeline code only.
2. Add/verify a clear Review Before Fill screen state.
3. Ensure all assisted apply steps require user approval.
4. Add audit events for every step.
5. Keep final employer-site submission manual.
6. Add focused tests for review confirmation, autofill gating, and audit logs.

Do not start payment work.

## 11. Key Commands For Testing And Building

Use Zap for noisy commands.

Backend:

```powershell
$env:PYTHONPATH='C:\Users\aadit\Documents\Codex\2026-05-31\you-are-a-senior-staff-engineer\apps\api'
zap ..\..\.venv\Scripts\python.exe -m pytest
```

CI migration check:

```powershell
$env:PYTHONPATH='C:\Users\aadit\Documents\Codex\2026-05-31\you-are-a-senior-staff-engineer\apps\api'
$env:DATABASE_URL='sqlite+aiosqlite:///./migration_verify.db'
zap ..\..\.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
zap ..\..\.venv\Scripts\python.exe -m alembic -c alembic.ini downgrade -1
zap ..\..\.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
```

Frontend:

```powershell
cd apps\web
zap "C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\typescript\bin\tsc" --noEmit
zap "C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\next\dist\bin\next" build
```

Extension:

```powershell
& "C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" --check apps\extension\popup.js
& "C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" apps\extension\tests\extraction-regression.test.js
& "C:\Users\aadit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" apps\extension\tests\manifest-popup-contract.test.js
```

Git:

```powershell
zap git status
zap git diff
```

## 12. Important Files And Directories To Inspect

Do not scan the whole repo unless necessary. Start here:

- `.github/workflows/ci.yml`
- `apps/api/app/presentation/api_v1/router.py`
- `apps/api/app/application/resumes/service.py`
- `apps/api/app/application/exports/service.py`
- `apps/api/app/application/tailoring/service.py`
- `apps/api/app/application/applications/autofill.py`
- `apps/api/app/infrastructure/db/models.py`
- `apps/api/migrations/versions/`
- `apps/api/tests/test_api.py`
- `apps/api/tests/test_resume_export_service.py`
- `apps/web/src/app/applications/page.tsx`
- `apps/web/src/app/jobs/page.tsx`
- `apps/web/src/app/resume/page.tsx`
- `apps/web/src/app/resume/templates/page.tsx`
- `apps/web/src/app/settings/page.tsx`
- `apps/web/src/lib/api.ts`
- `apps/extension/popup.js`
- `apps/extension/popup.html`
- `apps/extension/manifest.json`
- `apps/extension/tests/`
- `docs/PRODUCT_STATUS.md`
- `docs/FEATURE_MAP.md`
- `docs/TROUBLESHOOTING.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/USER_GUIDE.md`

## 13. Rules For Future Development

- Use Zap for noisy terminal commands.
- Avoid scanning the entire repo.
- Inspect only files relevant to the task.
- Keep docs updated with every meaningful feature, bug fix, API endpoint, migration, extension update, or workflow change.
- Update `PRODUCT_STATUS.md`, `FEATURE_MAP.md`, `TROUBLESHOOTING.md`, and user-facing guides when behavior changes.
- Do not start payment work yet.
- Do not implement automatic final job submission.
- Preserve existing functionality.
- Prefer small production-safe slices over broad rewrites.
- Run backend tests, frontend typecheck/build, migration checks, and extension checks before shipping.
