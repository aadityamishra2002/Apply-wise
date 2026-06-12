# Apply Wise Chrome Extension MVP

This unpacked Manifest V3 extension captures a visible job page and sends reviewed fields to Apply Wise for resume-aware scoring. It can inspect common application-form fields and fill user-approved fields from an Apply Wise autofill plan. It never submits applications.

## Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `apps/extension` directory.
5. In Apply Wise Settings, generate a one-time pairing code.
6. Open the extension popup, confirm the Apply Wise API URL, and enter that code.

Pairing codes expire after 10 minutes and can only be used once. The extension receives a scoped token for job capture, autofill planning, and assisted-application audit events. It cannot browse the user's full Apply Wise workspace.

The popup defaults to the production Railway API URL. If the backend domain changes, paste the new API base URL ending in `/api/v1`, click **Save API URL**, then pair again.

After changing extension files, click **Reload** for the unpacked extension in `chrome://extensions` or `brave://extensions`.

## Use

1. Open a job page.
2. Click the Apply Wise extension.
3. Review the extracted title, company, location, URL, and description.
4. Review **Capture readiness**. Fix any field marked **Needs review** or click **Re-extract current page** after opening the full job description.
5. Click **Send to Apply Wise**.
6. Open Apply Wise, prepare the application materials, and review the generated resume and cover letter.
7. Open **Review Application** in Apply Wise and click **I reviewed this application**. The extension will not load an autofill plan until this is done.
8. Return to the employer application page, click **Inspect application form**, then click **Load autofill plan**.
9. Review every suggested field. Sensitive or low-confidence fields are unchecked by default.
10. Select only the fields you approve and click **Fill reviewed fields**. Apply Wise logs the approved field keys before filling.
11. Review the **Resume upload status** panel. If the page has a resume upload field, download the tailored resume PDF or DOCX from the extension.
12. Attach the tailored resume manually when the browser blocks direct file assignment, then manually submit only after your own final review.

On an employer application page, click **Inspect application form** to preview commonly detected fields such as name, email, phone, resume upload, cover letter, LinkedIn, GitHub, portfolio, skills, education, salary expectation, notice period, work authorization, and pronouns.

Autofill is review-gated. Apply Wise only fills fields selected in the popup. It does not click final submit buttons and does not bypass employer-site validation. Browser security prevents extensions from setting a local file path on file inputs, so resume uploads are detected, shown as manual upload required, and logged. The extension can download the latest prepared tailored resume for the application so the user can attach it manually.

Autofill skips disabled, read-only, hidden, empty-value, checkbox, and radio controls that need manual confirmation. Select/dropdown fields are filled only when an option clearly matches the reviewed value; otherwise the popup logs the field as skipped.

If capture fails, the popup shows the API reason. Common causes are an expired pairing token, no master resume uploaded in Apply Wise, a short or empty description, an invalid URL, or a protected page where the extension cannot read the full job text.

The extraction logic uses adapters for Greenhouse, Lever, LinkedIn, Indeed, Naukri, Workday, Ashby, SmartRecruiters, Jobvite, iCIMS, BambooHR, Workable, and common company career pages with a general heuristic fallback. Review every extracted field because job-page markup can change over time.
