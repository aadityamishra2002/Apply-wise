# Apply Wise Troubleshooting

## Last Reviewed

- Date: 2026-06-22
- Commit: c581d96
- Version/release: Beta MVP, extension v0.3.3

## Purpose

Use this guide when local setup, deployment, resume parsing, job capture, generation, or extension workflows fail. Update it whenever a new support path, failure mode, or recovery step is discovered.

## Local Development Issues

### API Will Not Start

Check:

- `DATABASE_URL` is set or local Docker PostgreSQL is running.
- Alembic migrations have run.
- `APP_SECRET_KEY` is set for non-test environments.

Useful commands:

```powershell
$env:PYTHONPATH='apps/api'
.\.venv\Scripts\python.exe -m pytest apps/api/tests -q
cd apps\api
alembic -c alembic.ini current
alembic -c alembic.ini upgrade head
```

### Frontend Cannot Reach API

Check:

- `NEXT_PUBLIC_API_URL` points to the API base URL ending in `/api/v1`.
- Railway `CORS_ORIGINS` includes the Vercel or local frontend origin.
- API health returns `ok`.

Useful commands:

```powershell
curl http://localhost:8000/api/v1/health
curl https://jobsearchautomation-production.up.railway.app/api/v1/health
```

### Next.js Build Fails With Missing Chunks

Delete the local `.next` build output and rebuild:

```powershell
Remove-Item -Recurse -Force apps\web\.next
cd apps\web
npm run build
```

## Resume Issues

### Resume Upload Fails

Check:

- File is PDF or DOCX.
- File is under the configured upload size limit.
- User is authenticated.
- API logs do not show parser exceptions.

Relevant files:

- `apps/api/app/application/resumes/service.py`
- `apps/api/app/presentation/api_v1/router.py`
- `apps/web/src/app/resume/page.tsx`

### Parsed Resume Looks Wrong

Current parsing is deterministic and review-required. Use the resume editor to correct skills, experience, education, certifications, and projects. If parser behavior changes, update tests and `FEATURE_MAP.md`.

### Resume Template Upload Fails

Check:

- File is a DOCX template.
- File is under the configured upload size limit.
- Template includes at least one supported placeholder.
- User is authenticated.

Supported placeholders:

- `{{NAME}}`
- `{{CONTACT}}`
- `{{SUMMARY}}` or `{{PROFESSIONAL_SUMMARY}}`
- `{{SKILLS}}`
- `{{EXPERIENCE}}`
- `{{PROJECTS}}`
- `{{EDUCATION}}`
- `{{CERTIFICATIONS}}`

Relevant files:

- `apps/api/app/application/exports/service.py`
- `apps/api/app/presentation/api_v1/router.py`
- `apps/web/src/app/resume/templates/page.tsx`

### Generated Resume Does Not Match My Template

Check:

- The intended template is marked active on `/resume/templates`.
- The generated resume version shows the expected template name.
- The template uses supported placeholders in the section positions you want to control.
- Missing placeholders are expected to be appended after mapped content so verified sections are not lost.

DOCX export preserves the uploaded template structure where placeholders exist. PDF export follows the selected template section order first, then appends remaining supported sections in a clean ATS-friendly layout.

### Old Resume Version Uses A Deleted Template

Expected behavior:

- If a generated resume version references a deleted template, download resolves to the active custom template.
- If no custom template is active, download uses the built-in ATS-friendly template.

If fallback fails, check `resume_versions.template_id`, active `resume_templates`, and the download endpoint response body.

## Job And Generation Issues

### No Jobs Captured Or Matched

Check:

- A master resume exists.
- Search query is broad enough.
- Provider health is available.
- Manual pasted job has title, company, URL, and description with at least 40 characters.

Relevant files:

- `apps/web/src/app/jobs/page.tsx`
- `apps/api/app/application/jobs`
- `apps/api/app/presentation/api_v1/router.py`

### Generation Fails

Check:

- User has uploaded a resume.
- Job has a complete title, company, URL, and description.
- Gemini API quota/key is available, or deterministic fallback is working.
- Owner-scoped access is not blocking another user's job.

Expected behavior:

- Missing resume returns a clear error.
- Generated content must not invent skills, companies, projects, dates, metrics, or experience.

### Generated Resume Download Is Blocked

If unsupported-claim warnings exist, the API may block download until the user acknowledges the warnings. Review the generated content and remove unsupported claims before external use.

### Prepare Application Page Cannot Load Or Generate

Check:

- The application belongs to the logged-in user.
- A master resume exists before generation.
- The job has title, company, URL, and enough description text.
- `GET /applications/{id}/review-before-apply` returns job details, scores, selected template metadata, and material IDs if already generated.
- `POST /applications/{id}/prepare` returns `resume_version_id`, `cover_letter_id`, `template_name`, matching skills, missing skills, and `application_status: preparing`.

Relevant files:

- `apps/web/src/app/applications/[id]/prepare/page.tsx`
- `apps/web/src/app/jobs/page.tsx`
- `apps/api/app/presentation/api_v1/router.py`
- `apps/api/tests/test_api.py`

## Application Tracking Issues

### Mark As Applied Does Nothing

Expected flow:

1. User manually submits on the employer site.
2. User clicks **Mark as Applied** in Apply Wise.
3. Confirmation text appears.
4. User clicks OK.
5. Frontend sends `PATCH /applications/{id}` with `manual_submission_confirmed: true`.
6. Status becomes `applied` and persists after refresh.

If it fails, check:

- Browser console for request errors.
- API response body.
- Application owner scope.
- `application_marked_applied` event in the timeline.

Relevant files:

- `apps/web/src/app/applications/page.tsx`
- `apps/api/app/presentation/api_v1/router.py`
- `apps/api/tests/test_api.py`

## Extension Debugging Guide

### Extension Shows Old Version

Reload the unpacked extension:

1. Open `brave://extensions` or `chrome://extensions`.
2. Enable Developer mode.
3. Find Apply Wise Job Capture.
4. Click Reload.
5. Open the popup and confirm the expected version.

Current expected version: `0.3.3`.

### Pairing Token Expired

Pairing codes expire quickly and are one-time use.

Recovery:

1. Open Apply Wise Settings.
2. Generate a fresh extension pairing code.
3. Paste it into the extension popup.
4. Pair again.

### Capture Fails Because Resume Is Missing

The backend should return:

```json
{
  "ok": false,
  "error_code": "missing_resume",
  "message": "Upload a master resume in Apply Wise before capturing LinkedIn jobs.",
  "details": {
    "action": "upload_resume"
  }
}
```

Recovery: upload a master resume, then re-send the captured job.

### LinkedIn Extraction Is Empty Or Noisy

Use the popup debug report.

Check:

- Active tab URL is a LinkedIn job URL.
- Site type is LinkedIn.
- Extraction layer used is not `manual_required` unless fields are actually missing.
- Title, company, URL, and description length are valid.
- Description does not include navigation, Premium prompts, recommended jobs, footer text, or language selectors.

Recovery:

1. Expand the full LinkedIn job description.
2. Click **Re-extract current page**.
3. Manually paste missing title, company, URL, or description into the popup.
4. Use **Copy Debug Report** if extraction still fails.

### Generic Career Page Missing Company

Some company pages do not expose a clean company selector. Paste the employer name manually into the Company field before sending.

### Autofill Plan Will Not Load

Check:

- The job was captured and saved to Apply Wise.
- The application exists.
- The web Review Application screen was opened and confirmed.
- Extension token is still valid.

Apply Wise must never final-submit an application. Users approve fields, the extension fills approved fields only, and the user manually clicks final submit on the employer site.

## Deployment Issues

### Railway API Is Down

Check:

- Railway deployment logs.
- `/api/v1/health`
- `/api/v1/health/ready`
- Database connection variable.
- Alembic migration output.

### Vercel Build Cannot Detect Next.js

Make sure Vercel root directory is `apps/web`, because the Next.js `package.json` is there.

### CORS Errors In Browser

Make sure Railway `CORS_ORIGINS` contains the exact Vercel production URL and any preview URLs that need API access.

## Required Documentation Updates For New Failure Modes

When a new failure mode is found:

- Add the symptom.
- Add likely causes.
- Add exact recovery steps.
- Add related files.
- Add tests or manual verification steps when applicable.
- Update `FEATURE_MAP.md` and `PRODUCT_STATUS.md` if product behavior changed.
