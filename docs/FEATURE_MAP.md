# Apply Wise Feature Map

## Last Reviewed

- Date: 2026-06-22
- Commit: pending
- Version/release: Beta MVP, extension v0.3.3

## Purpose

This file maps major product features to the code and data they use. Update it whenever a feature, workflow, endpoint, table, or extension capability changes.

## Feature Ownership Map

| Feature | User surface | Backend/API files | Frontend/extension files | Database tables |
|---|---|---|---|---|
| Authentication and sessions | Login, register, logout, refresh session | `apps/api/app/presentation/api_v1/auth.py`, identity services/repositories | `apps/web/src/app/login/page.tsx`, `apps/web/src/app/register/page.tsx`, `apps/web/src/lib/api.ts` | `users`, `refresh_tokens` |
| Password reset | Forgot/reset password pages | `auth.py`, identity services/repositories | `apps/web/src/app/forgot-password/page.tsx`, `apps/web/src/app/reset-password/page.tsx` | `password_reset_tokens`, `refresh_tokens` |
| Resume upload and parsing | Resume workspace | `router.py`, `app/application/resumes/service.py` | `apps/web/src/app/resume/page.tsx`, `apps/web/src/lib/api.ts` | `master_resumes`, `resume_skills`, `resume_experiences`, `resume_education`, `resume_certifications`, `resume_projects`, `activity_logs` |
| Resume profile editing | Resume workspace editor | Resume service and `PATCH /resumes/me` | `apps/web/src/app/resume/page.tsx` | Resume child tables |
| Resume template management | Resume Templates page | `GET/POST/PATCH/DELETE /resume-templates`, `PATCH /resume-templates/{id}/activate`, `POST /resume-templates/{id}/select`, `GET /resume-templates/active/preview`, export service | `apps/web/src/app/resume/templates/page.tsx`, `apps/web/src/app/resume/page.tsx`, `apps/web/src/lib/api.ts` | `resume_templates`, `resume_versions`, `activity_logs` |
| Job search | Jobs page | `router.py`, provider factory, Adzuna/Remotive providers | `apps/web/src/app/jobs/page.tsx` | `jobs`, `job_matches`, `job_preferences`, `activity_logs` |
| Manual job paste | Jobs page manual capture form | `POST /jobs/manual` in `router.py` | `apps/web/src/app/jobs/page.tsx` | `jobs`, `job_matches`, `applications`, `activity_logs` |
| Public URL import | Jobs page URL import | `POST /jobs/import-url`, HTML extraction helpers | `apps/web/src/app/jobs/page.tsx` | `jobs`, `job_matches`, `activity_logs` |
| Extension job capture | Chrome/Brave extension popup | `POST /extension/jobs/capture`, extension token dependencies | `apps/extension/popup.js`, `apps/extension/popup.html` | `extension_pairing_codes`, `jobs`, `job_matches`, `applications`, `activity_logs` |
| ATS and match scoring | Jobs page score cards, 80+ queue | Job matching and ATS services, `GET /jobs` | `apps/web/src/app/jobs/page.tsx` | `job_matches`, `activity_logs` |
| Resume generation | Jobs page, Prepare Application page, and Applications workflow | `POST /jobs/{id}/resume-versions`, `POST /applications/{id}/prepare`, tailoring service, template-aware export service | `apps/web/src/app/jobs/page.tsx`, `apps/web/src/app/applications/[id]/prepare/page.tsx`, `apps/web/src/app/applications/page.tsx` | `resume_versions`, `resume_templates`, `applications`, `application_events`, `activity_logs` |
| Cover letter generation | Jobs page, Prepare Application page, and Applications workflow | `POST /jobs/{id}/cover-letters`, `POST /applications/{id}/prepare`, tailoring service | `apps/web/src/app/jobs/page.tsx`, `apps/web/src/app/applications/[id]/prepare/page.tsx`, `apps/web/src/app/applications/page.tsx` | `cover_letters`, `applications`, `application_events`, `activity_logs` |
| Generated artifact download | Jobs/Application preview actions | Resume export and cover-letter download endpoints | `apps/web/src/app/jobs/page.tsx`, `apps/web/src/app/applications/page.tsx` | `resume_versions`, `cover_letters`, `application_events` |
| Application tracking | Applications board | Application routes in `router.py` | `apps/web/src/app/applications/page.tsx` | `applications`, `application_events`, `interviews` |
| Mark as Applied | Applications board confirmation | `PATCH /applications/{id}` | `apps/web/src/app/applications/page.tsx` | `applications`, `application_events`, `activity_logs` |
| Review Application and Assisted Apply readiness | Application detail workflow and Prepare Application page | `GET /applications/{id}/review-before-apply`, `POST /applications/{id}/review-before-apply/confirm`, `GET /applications/{id}/assisted-checklist` in `router.py` | `apps/web/src/app/applications/[id]/prepare/page.tsx`, `apps/web/src/app/applications/page.tsx`, `apps/web/src/lib/api.ts` | `applications`, `application_events`, `job_matches`, `resume_versions`, `cover_letters` |
| Assisted autofill plan | Extension after Review Application confirmation | `GET /extension/applications/{id}/autofill-plan` | `apps/extension/popup.js` | `user_profiles`, resume tables, `application_events` |
| Extension resume download for upload | Extension PDF/DOCX download buttons | `GET /extension/applications/{id}/resume-download` | `apps/extension/popup.js` | `resume_versions`, `application_events` |
| Application profile | Settings page | `GET/PUT /settings/profile` | `apps/web/src/app/settings/page.tsx` | `user_profiles` |
| Dashboard summary and checklist | Dashboard | `GET /dashboard/summary`, activity logs | `apps/web/src/app/dashboard/page.tsx` | `applications`, `job_matches`, `activity_logs`, `extension_pairing_codes` |
| Analytics | Analytics page | `GET /analytics/summary` | `apps/web/src/app/analytics/page.tsx` | `applications`, `job_matches` |
| Account export and privacy guidance | Settings page | Account export and settings routes | `apps/web/src/app/settings/page.tsx` | User-owned workspace tables |
| Public compliance pages | Marketing/legal routes | Static Next.js pages | `apps/web/src/app/about`, `pricing`, `terms`, `privacy`, `refund-policy`, `shipping-policy`, `contact` | None |
| Admin summary | Admin page | `GET /admin/summary` | `apps/web/src/app/admin/page.tsx` | Users, jobs, applications, generated artifacts, subscriptions |

## API Endpoint Documentation Rule

When adding or changing an endpoint, add a row or note with:

- Method and path
- Auth type
- Request body or query parameters
- Response body
- Related frontend/extension files
- Tables touched
- Tests added or updated

## Resume Template API Summary

| Method/path | Purpose | Request | Response | Tables touched |
|---|---|---|---|---|
| `GET /resume-templates` | List built-in default and custom user templates | None | Array of template metadata with active state and placeholders | `resume_templates` |
| `POST /resume-templates` or `POST /resume-templates/upload` | Upload and activate a DOCX template | Multipart `file` with supported placeholders | Template metadata | `resume_templates`, `activity_logs` |
| `GET /resume-templates/active/preview` | Preview active-template section mapping | None | Active template, section order, missing placeholders, preview sections | `resume_templates` |
| `PATCH /resume-templates/{template_id}` | Rename a custom template | `{ "name": "..." }` | Template metadata | `resume_templates`, `activity_logs` |
| `PATCH /resume-templates/{template_id}/activate` or `POST /resume-templates/{template_id}/select` | Select a custom template or `default` | None | Selected template metadata | `resume_templates`, `activity_logs` |
| `DELETE /resume-templates/{template_id}` | Delete a custom template and clear version references | None | `204 No Content` | `resume_templates`, `resume_versions`, `activity_logs` |

## Extension Feature Documentation Rule

When adding an extension feature, update:

- This map
- `docs/DEVELOPER_GUIDE.md` extension architecture notes
- `docs/TROUBLESHOOTING.md` debugging steps and common failure modes
- `apps/extension/README.md`

## Database Migration Documentation Rule

When adding a migration, update:

- The feature row that owns the changed tables
- `docs/DEVELOPER_GUIDE.md` database map and table ownership section
- `docs/PRODUCT_STATUS.md` if behavior or stored data changes
