# Apply Wise User Guide

Last updated: 2026-10-21

Use this guide when you want the fastest, most useful workflow from Apply Wise and the browser extension.

## Current Live Beta And Feature Status

Live site: https://apply-wise-1.vercel.app

The limited free beta runs on Vercel, Render, Supabase, and Upstash. The latest deployment is live, and the API readiness endpoint has reported the database and rate limiter ready. The public homepage, sign-in, and registration pages load. The feature code and API workflows below are present, but a complete authenticated user journey has not yet been verified after the hosting change. This is a status distinction: a working page or health check alone does not prove every account workflow.

| Feature advertised on the public site | Available in the product | Current verification and limits |
|---|---|---|
| Resume upload and parsing | PDF and DOCX upload, extracted profile fields, and profile editing are implemented. | Not end-to-end tested after the latest deployment. Review and correct extracted details. |
| Job discovery and fit matching | Provider search plus manual paste/URL import and resume-aware match explanations are implemented. | Live provider health lists Remotive as configured; Adzuna is not listed. A live job search/results query was not run, so India-specific Adzuna listings are not confirmed and Remotive results still need a live check. |
| ATS insights and tailored drafts | ATS readiness scoring, tailored resume and cover-letter drafts, and export flows are implemented. A deterministic fallback is available when AI enhancement is unavailable. | Scores are guidance, not a hiring-system guarantee. Check every generated claim and file before use. |
| Application tracking | Saved roles, statuses, notes, activity, and interview rounds are implemented. | Persistent user workflows were not exercised after this deployment. |
| Review before applying | The workflow requires user review; final employer submission stays manual. | The extension is optional, browser-specific, and not verified as part of the current live smoke check. |
| Free beta and paid plans | Free beta access is shown. | Paid checkout and subscriptions are not enabled; paid tiers shown as planned are not purchasable. |

The free hosting setup may sleep, pause, restart, or hit provider quotas; the first API request after inactivity can be slow. Keep your own copy of important files. Do not rely on this beta for guaranteed uptime, backups, or recovery of user data.

## Best Workflow

1. Open Apply Wise at https://apply-wise-1.vercel.app and create a free beta account, or log in if you already have one.
2. Upload your latest master resume from the **Resume** page. DOCX works best and can also become your active resume layout.
3. Review the extracted profile and fix anything important before applying.
4. Optional: open **Resume Templates** from the Resume page and select the DOCX layout you want future tailored resumes to use.
5. Go to **Settings** and complete your application profile:
   - Name
   - Email
   - Phone
   - Location
   - LinkedIn
   - GitHub
   - Portfolio
6. Search or capture jobs.
7. Focus first on jobs with stronger match and ATS scores.
8. Generate a tailored resume and cover letter for each selected job.
9. Review every generated draft before using it.
10. Apply manually on the employer site.
11. Track the application status in Apply Wise.

## Use Resume Templates

1. Go to **Resume**.
2. Open **Resume Templates**.
3. Upload a DOCX template if you want Apply Wise to use your own layout. Uploaded DOCX templates preserve formatting better than PDF.
4. For the most controlled output, add supported placeholders where generated content should go:
   - `{{NAME}}`
   - `{{CONTACT}}`
   - `{{SUMMARY}}`
   - `{{SKILLS}}`
   - `{{EXPERIENCE}}`
   - `{{PROJECTS}}`
   - `{{EDUCATION}}`
   - `{{CERTIFICATIONS}}`
5. If your DOCX has no placeholders, Apply Wise will still use it as the base layout and replace matching sections where possible.
6. Select the template you want to use.
7. Use **Preview active template** to confirm where content will go.
8. Generate a tailored resume from a job.
9. Check the generated resume preview and confirm the template name shown for that resume version.
10. Download DOCX or PDF.

If you upload a DOCX master resume, Apply Wise automatically creates an active master-resume layout from it. If you do not upload a DOCX master/template, Apply Wise uses the built-in ATS-friendly template. PDF export may not be pixel-perfect; DOCX preserves formatting more closely.

## One-Time Extension Setup

1. Open Brave or Chrome.
2. Go to `brave://extensions` or `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the `apps/extension` folder from this repository.
6. Open Apply Wise.
7. Go to **Settings**.
8. Click **Generate pairing code**.
9. Open the Apply Wise extension popup.
10. Confirm the API URL shown in the popup.
11. Paste the pairing code.
12. Click **Pair extension**.

Pairing codes expire after 10 minutes. If pairing fails, generate a fresh code from **Settings** and pair again.

## Capture A Job With The Extension

1. Open a job page on LinkedIn, Naukri, Indeed, Workday, Greenhouse, Lever, Ashby, or a company career page.
2. If the site hides part of the job description, expand the full job description first.
3. Click the Apply Wise extension.
4. Click **Re-extract current page** if the fields are blank or incomplete.
5. Review:
   - Job title
   - Company
   - Location
   - Job URL
   - Description
6. If title, company, URL, or description is missing, paste or fix it directly in the extension popup.
7. If a generic company career page misses the company name, copy the employer name from the page header or URL and paste it into the Company field.
8. Check **Capture readiness**.
9. Click **Send to Apply Wise**.
10. Open Apply Wise and go to **Jobs**.
11. Select the captured job.

## Use The Website Without The Extension

1. Go to **Jobs**.
2. Search by role and location, or paste a job manually.
3. Open a saved or imported job.
4. Review the match score, ATS score, matching skills, and missing skills.
5. Decide whether the job is worth preparing.

## Prepare A Job Application

1. Open the job from the **Jobs** page.
2. Review:
   - Match score
   - ATS score
   - Matching skills
   - Missing skills
3. Click **Prepare Application**.
4. On the prepare page, review the job details, scores, missing skills, and selected resume template.
5. Click **Generate materials** if the tailored resume and cover letter are not ready yet.
6. Review and edit the tailored resume.
7. Review and edit the cover letter.
8. Download the tailored resume as DOCX or PDF. Use DOCX when preserving the selected resume/template formatting matters most.
9. Download the cover letter.
10. Click **I reviewed this application** only after checking the generated content and warnings.
11. Apply manually on the employer site.
12. Mark the application as **Applied** only after manual submission.

Do not use a generated draft blindly. Always check dates, titles, skills, company names, and project details before applying.

## Use Assisted Autofill

1. Capture the job with the extension.
2. Open **Prepare Application** for that role.
3. Generate or review the application materials in Apply Wise.
4. Review the job, resume, cover letter, missing fields, and warnings.
5. Click **I reviewed this application**.
6. Return to the employer application form.
7. Open the Apply Wise extension.
8. Click **Inspect application form**.
9. Click **Load autofill plan**.
10. Review every suggested field.
11. Select only the fields you approve.
12. Click **Fill reviewed fields**.
13. Review the employer form manually.
14. Submit manually only when you are satisfied.

Apply Wise does not click the final submit button for you.

## Resume Upload During Applications

1. If the employer form asks for a resume file, use the tailored resume generated for that job.
2. Download the tailored resume as PDF or DOCX from Apply Wise or the extension.
3. Attach the downloaded file on the employer site.
4. If the extension shows **manual upload required**, upload the file yourself.
5. Review the uploaded file name before submitting.

## Track Applications

1. Go to **Applications**.
2. Open **Prepare Application** when you need to review or update generated materials for a saved role.
3. Move each job to the correct status:
   - Saved
   - Preparing
   - Applied
   - Interview
   - Rejected
   - Offer
   - Withdrawn
4. Add notes after important events.
5. Add interview rounds when interviews are scheduled.
6. Keep rejected or withdrawn roles updated so your dashboard stays accurate.

## Daily Job Search Routine

1. Start with 5 to 10 good-fit jobs, not every job you see.
2. Capture each job into Apply Wise.
3. Prioritize roles with stronger match and ATS scores.
4. Generate application materials only for jobs you actually want.
5. Apply manually after reviewing the final resume and cover letter.
6. Update the application status immediately after applying.
7. Review missing skills weekly and improve your master resume only when the skill is true.

## Common Issues

### Extension Shows Blank Fields

1. Expand the full job description on the job site.
2. Click **Re-extract current page**.
3. If fields are still blank, paste the title, company, URL, and description manually.
4. Click **Send to Apply Wise** after readiness checks pass.

### Send To Apply Wise Is Disabled

Check that these fields are filled:

- Job title
- Company
- Job URL
- Description with at least 40 characters

Location can be blank if the job site does not show it clearly.

### Pairing Failed

1. Go back to Apply Wise **Settings**.
2. Generate a new pairing code.
3. Paste the new code in the extension.
4. Click **Pair extension** again.

### Capture Succeeds But The Job Is Not Useful

1. Open the job on the **Jobs** page.
2. Check missing skills and ATS score.
3. If the match is weak, save your time and move to a better-fit role.

## Screenshots

Screenshots are not included yet. When product screenshots are added, keep them in `docs/screenshots` and update this guide with the latest user flow.
