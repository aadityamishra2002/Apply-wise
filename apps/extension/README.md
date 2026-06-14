# Apply Wise Chrome Extension MVP

This unpacked Manifest V3 extension captures a visible job page and sends reviewed fields to Apply Wise for resume-aware scoring. It can inspect common application-form fields and fill user-approved fields from an Apply Wise autofill plan. It never submits applications.

Current extension version: `0.3.2`.

## Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `apps/extension` directory.
5. In Apply Wise Settings, generate a one-time pairing code.
6. Open the extension popup, confirm the Apply Wise API URL, and enter that code.

Pairing codes expire after 10 minutes and can only be used once. The extension receives a scoped token for job capture, autofill planning, and assisted-application audit events. It cannot browse the user's full Apply Wise workspace.

The popup defaults to the production Railway API URL. If the backend domain changes to another Railway domain, paste the new API base URL ending in `/api/v1`, click **Save API URL**, then pair again. The extension manifest allows Railway subdomains and LinkedIn job pages.

After changing extension files, click **Reload** for the unpacked extension in `chrome://extensions` or `brave://extensions`.

Manifest V3 note: the extension intentionally does not use persistent `content_scripts`. It uses `activeTab` plus `chrome.scripting.executeScript` from the popup so extraction runs inside the currently active job tab only after the user opens the extension.

## Use

1. Open a job page.
2. Click the Apply Wise extension.
3. Review the extracted title, company, location, URL, and description.
4. Review **Capture readiness**. Fix any required field marked **Needs review** or click **Re-extract current page** after opening the full job description. Location is optional.
5. Review **Extraction diagnostics** and **LinkedIn debug report** to see which layer produced the title, company, location, description, token/backend status, response body, and validation errors.
6. Click **Send to Apply Wise** after all readiness checks pass.
7. Open Apply Wise, prepare the application materials, and review the generated resume and cover letter.
8. Open **Review Application** in Apply Wise and click **I reviewed this application**. The extension will not load an autofill plan until this is done.
9. Return to the employer application page, click **Inspect application form**, then click **Load autofill plan**.
10. Review every suggested field. Sensitive or low-confidence fields are unchecked by default.
11. Select only the fields you approve and click **Fill reviewed fields**. Apply Wise logs the approved field keys before filling.
12. Review the **Resume upload status** panel. If the page has a resume upload field, download the tailored resume PDF or DOCX from the extension.
13. Attach the tailored resume manually when the browser blocks direct file assignment, then manually submit only after your own final review.

On an employer application page, click **Inspect application form** to preview commonly detected fields such as name, email, phone, resume upload, cover letter, LinkedIn, GitHub, portfolio, skills, education, salary expectation, notice period, work authorization, and pronouns.

Autofill is review-gated. Apply Wise only fills fields selected in the popup. It does not click final submit buttons and does not bypass employer-site validation. Browser security prevents extensions from setting a local file path on file inputs, so resume uploads are detected, shown as manual upload required, and logged. The extension can download the latest prepared tailored resume for the application so the user can attach it manually.

Autofill skips disabled, read-only, hidden, empty-value, checkbox, and radio controls that need manual confirmation. Select/dropdown fields are filled only when an option clearly matches the reviewed value; otherwise the popup logs the field as skipped.

If capture fails, the popup shows the API error code, message, response status, and response body in the debug report. Common causes are an expired pairing token, no master resume uploaded in Apply Wise, a short or empty description, an invalid URL, or a protected page where the extension cannot read the full job text. If automatic extraction is incomplete, manually paste/fix title, company, URL, and description in the popup and send again.

The extraction logic uses adapters for Greenhouse, Lever, LinkedIn, Indeed, Naukri, Workday, Ashby, SmartRecruiters, Jobvite, iCIMS, BambooHR, Workable, and common company career pages with a general heuristic fallback. Review every extracted field because job-page markup can change over time.

## LinkedIn Extraction Check

After reloading the unpacked extension, test both:

- `https://www.linkedin.com/jobs/view/4424855234/`
- `https://www.linkedin.com/jobs/view/4425607893/`
- `https://www.linkedin.com/jobs/view/4424582004/?alternateChannel=search&eBP=BUDGET_EXHAUSTED_JOB&trk=d_flagship3_jobs_discovery_jymbii&refId=D6ZVOyifP0bVAzF0nWvuiQ%3D%3D&trackingId=H6NdQFF1Jn4tTjU2w5rcuA%3D%3D`

Expected result:

- Title: `AI Senior Software Engineer`
- Company: `Sopra Steria`
- Location: `Noida, Uttar Pradesh, India`
- Description: only the actual job-description content and requirements

The LinkedIn adapter supports both `/jobs/view/{jobId}` and `/jobs/collections/recommended/?currentJobId={jobId}`. It does not use `linkedin.com` as a company fallback. It tries selectors, meta tags, JSON-LD, and visible text heuristics. If title, company, URL, or a 40+ character description is missing, **Send to Apply Wise** stays disabled until the user manually fixes the editable fields.

If LinkedIn returns missing fields, expand **Extraction diagnostics** in the popup. It shows `document.readyState`, `document.body.innerText.length`, the first 1000 characters of body text, collected visible-text length, whether a main candidate container was found, the selected candidate selector, candidate text length, the first 500 characters of candidate text, selector-match counts for title/company/location/description, extraction layer used, backend URL, token presence, backend status/body, and validation errors. Click **Copy Debug Report** when reporting a capture issue. Click **Re-extract current page** after the LinkedIn job panel finishes loading; re-extract waits briefly for dynamic LinkedIn content before parsing.

Manual LinkedIn smoke checklist:

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Find **Apply Wise Job Capture** and click **Reload**.
4. Confirm the popup shows version `0.3.2`.
5. Open a LinkedIn job detail page, for example `https://www.linkedin.com/jobs/view/4424855234/`.
6. Click the extension and confirm title, company, URL, and description are filled. Location may be blank if LinkedIn hides it.
7. If anything required is blank, paste/fix it directly in the popup.
8. Click **Send to Apply Wise**.
9. Confirm the success message shows a match score.
10. Open Apply Wise Applications and confirm the captured job appears in the review workflow.
