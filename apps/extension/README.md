# Apply Wise Chrome Extension MVP

This unpacked Manifest V3 extension captures a visible job page and sends reviewed fields to Apply Wise for resume-aware scoring. It can also inspect common application-form fields locally. It does not autofill forms or submit applications.

## Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `apps/extension` directory.
5. In Apply Wise Settings, generate a one-time pairing code.
6. Open the extension popup and enter that code.

Pairing codes expire after 10 minutes and can only be used once. The extension receives a capture-only token; it cannot read the user's Apply Wise workspace.

## Use

1. Open a job page.
2. Click the Apply Wise extension.
3. Review the extracted title, company, location, URL, and description.
4. Click **Send to Apply Wise**.
5. Open Apply Wise job discovery to continue reviewing the role.

On an employer application page, click **Inspect application form** to preview commonly detected fields such as name, email, phone, resume upload, cover letter, LinkedIn, and work authorization. Detection stays in the browser and does not fill or submit anything.

The extraction logic uses adapters for Greenhouse, Lever, and LinkedIn pages with a general heuristic fallback. Review every extracted field because job-page markup can change over time.
