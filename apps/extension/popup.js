const apiUrl = "https://jobsearchautomation-production.up.railway.app/api/v1";
const fields = ["title", "company", "location", "url", "description"];

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("pair").addEventListener("click", pair);
  document.getElementById("send").addEventListener("click", send);
  document.getElementById("refresh").addEventListener("click", extract);
  document.getElementById("inspect-form").addEventListener("click", inspectForm);
  document.getElementById("load-autofill").addEventListener("click", loadAutofillPlan);
  document.getElementById("fill-reviewed").addEventListener("click", fillReviewedFields);
  document.getElementById("download-resume-pdf").addEventListener("click", () => downloadTailoredResume("pdf"));
  document.getElementById("download-resume-docx").addEventListener("click", () => downloadTailoredResume("docx"));
  document.getElementById("unpair").addEventListener("click", unpair);
  for (const field of fields) document.getElementById(field).addEventListener("input", updateQualityPreview);
  const { extensionToken } = await chrome.storage.local.get("extensionToken");
  showPaired(Boolean(extensionToken));
  if (extensionToken) await extract();
});

async function pair() {
  const code = document.getElementById("code").value.trim();
  const response = await fetchWithRetry(`${apiUrl}/extension/pair`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  }, { retries: 1 });
  if (!response.ok) return message("Pairing failed. Generate a fresh code in Apply Wise Settings.");
  const body = await response.json();
  await chrome.storage.local.set({ extensionToken: body.extension_token });
  showPaired(true);
  await extract();
  message("Paired. Review the extracted fields before sending.");
}

async function unpair() {
  await chrome.storage.local.remove("extensionToken");
  showPaired(false);
  message("Extension unpaired.");
}

async function extract() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  let result;
  try {
    [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage });
  } catch (error) {
    message(`Extraction failed on this page: ${error.message}. Paste the fields manually or open the full job description page.`);
    updateQualityPreview();
    return;
  }
  for (const field of fields) document.getElementById(field).value = result[field] ?? "";
  updateQualityPreview();
  message(`Extracted with the ${result.extractor} page adapter. Review every field before sending.`);
}

async function send() {
  const { extensionToken } = await chrome.storage.local.get("extensionToken");
  const payload = Object.fromEntries(fields.map((field) => [field, document.getElementById(field).value.trim()]));
  const quality = captureQuality(payload);
  const blocking = quality.filter((item) => !item.ready);
  if (!extensionToken) return message("Pair the extension again from Apply Wise Settings before sending.");
  if (blocking.length) return message(`Capture blocked: ${blocking.map((item) => item.label).join(", ")} need review.`);
  const response = await fetchWithRetry(`${apiUrl}/extension/jobs/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${extensionToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, { retries: 2 });
  if (!response.ok) return message(response.status === 401 ? "Capture failed because the extension pairing expired. Generate a fresh code in Apply Wise Settings and pair again." : `Capture failed: ${await responseMessage(response)}`);
  const body = await response.json();
  if (body.application_id) await chrome.storage.local.set({ lastApplicationId: body.application_id });
  message(`Captured with a ${body.match_score}% resume match. ${body.application_id ? "You can now load the assisted autofill plan." : "Save this role in Apply Wise before assisted autofill."}`);
}

async function fetchWithRetry(url, options, { retries = 1, timeoutMs = 12000 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!shouldRetry(response.status) || attempt === retries) return response;
      await waitForRetry(response, attempt);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === retries) throw error;
      await waitForRetry(null, attempt);
    }
  }
  throw lastError ?? new Error("Request failed.");
}

function shouldRetry(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function waitForRetry(response, attempt) {
  const retryAfter = Number(response?.headers?.get("Retry-After"));
  const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
    ? Math.min(retryAfter * 1000, 5000)
    : 500 * 2 ** attempt;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function responseMessage(response) {
  let body = null;
  try { body = await response.json(); } catch { return `HTTP ${response.status}`; }
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) {
    return body.detail.map((error) => {
      const field = Array.isArray(error.loc) ? error.loc.filter((part) => part !== "body").join(".") : "";
      return `${field || "request"}: ${error.msg}`;
    }).join("; ");
  }
  return `HTTP ${response.status}`;
}

async function inspectForm() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectApplicationFields });
  const list = document.getElementById("detected-fields");
  list.replaceChildren();
  for (const field of result) {
    const item = document.createElement("li");
    item.textContent = `${field.label} (${field.kind})${field.type === "file" ? " - resume upload candidate" : ""}`;
    list.appendChild(item);
  }
  document.getElementById("form-preview").hidden = false;
  message(result.length ? `Found ${result.length} application fields. Load an autofill plan when your materials are prepared.` : "No common application fields were detected on this page.");
}

async function loadAutofillPlan() {
  const { extensionToken, lastApplicationId } = await chrome.storage.local.get(["extensionToken", "lastApplicationId"]);
  if (!extensionToken) return message("Pair the extension again from Apply Wise Settings before assisted autofill.");
  if (!lastApplicationId) return message("Send or save the job first, then prepare materials in Apply Wise before loading autofill.");
  const response = await fetchWithRetry(`${apiUrl}/extension/applications/${lastApplicationId}/autofill-plan`, {
    headers: { Authorization: `Bearer ${extensionToken}` },
  }, { retries: 2 });
  if (!response.ok) {
    if (response.status === 401) return message("Autofill failed because the extension pairing expired. Generate a fresh code in Apply Wise Settings and pair again.");
    if (response.status === 409) return message(`Review required: ${await responseMessage(response)}`);
    return message(`Could not load autofill plan: ${await responseMessage(response)}`);
  }
  const plan = await response.json();
  await chrome.storage.local.set({ autofillPlan: plan });
  renderAutofillPlan(plan);
  message(`Loaded ${plan.fields.length} suggested fields for ${plan.company}. Review before filling.`);
}

function renderAutofillPlan(plan) {
  const list = document.getElementById("autofill-fields");
  list.replaceChildren();
  for (const warning of plan.warnings || []) {
    const item = document.createElement("li");
    item.className = "warning";
    item.textContent = warning;
    list.appendChild(item);
  }
  for (const field of plan.fields) {
    const item = document.createElement("li");
    item.className = "field-card";
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.fieldKey = field.field_key;
    checkbox.checked = Boolean(field.value) && !field.requires_review && field.confidence >= 0.75 && field.field_key !== "resume_file";
    const title = document.createElement("span");
    title.textContent = `${field.label} (${Math.round(field.confidence * 100)}% confidence)`;
    label.append(checkbox, title);
    const details = document.createElement("p");
    const preview = field.field_key === "resume_file" ? "Resume upload is handled manually if the browser blocks file attachment." : truncate(field.value, 140);
    details.textContent = `${preview || "Manual value required"} · Source: ${field.source}${field.sensitive ? " · Sensitive" : ""}${field.requires_review ? " · Needs review" : ""}`;
    item.append(label, details);
    list.appendChild(item);
  }
  const resumeField = plan.fields.find((field) => field.field_key === "resume_file");
  updateUploadStatus(resumeField?.value ? "Prepared tailored resume detected. If this page has a resume upload field, download the generated PDF/DOCX and attach it manually if browser upload is blocked." : "Prepare a tailored resume in Apply Wise before resume upload assistance.");
  document.getElementById("autofill-preview").hidden = false;
}

async function fillReviewedFields() {
  const { extensionToken, autofillPlan } = await chrome.storage.local.get(["extensionToken", "autofillPlan"]);
  if (!autofillPlan) return message("Load an autofill plan first.");
  const approvedKeys = [...document.querySelectorAll("#autofill-fields input[type='checkbox']:checked")].map((input) => input.dataset.fieldKey);
  const approvedFields = autofillPlan.fields.filter((field) => approvedKeys.includes(field.field_key) && field.value);
  if (!approvedFields.length) return message("Select at least one reviewed field to fill.");
  if (extensionToken) {
    await fetchWithRetry(`${apiUrl}/extension/applications/${autofillPlan.application_id}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${extensionToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "autofill_approved",
        metadata: {
          approved_field_keys: approvedFields.map((field) => field.field_key),
          approved_field_count: approvedFields.length,
          manual_final_submission_required: true,
        },
      }),
    }, { retries: 1 }).catch(() => null);
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  let result;
  try {
    [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fillApplicationFields, args: [approvedFields] });
  } catch (error) {
    return message(`Autofill failed on this page: ${error.message}`);
  }
  if (extensionToken) {
    await fetchWithRetry(`${apiUrl}/extension/applications/${autofillPlan.application_id}/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${extensionToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "autofill_attempted", metadata: result }),
    }, { retries: 1 }).catch(() => null);
    if (result.resumeUploadFields > 0) {
      await fetchWithRetry(`${apiUrl}/extension/applications/${autofillPlan.application_id}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${extensionToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "resume_upload_attempted", metadata: { detected_upload_fields: result.resumeUploadFields, direct_upload_supported: false } }),
      }, { retries: 1 }).catch(() => null);
      await fetchWithRetry(`${apiUrl}/extension/applications/${autofillPlan.application_id}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${extensionToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "resume_upload_failed", metadata: { detected_upload_fields: result.resumeUploadFields, reason: "browser_blocked_file_path", manual_upload_required: true } }),
      }, { retries: 1 }).catch(() => null);
    }
  }
  const uploadHint = result.resumeUploadFields > 0 ? ` Found ${result.resumeUploadFields} resume upload field(s); download the tailored resume from Apply Wise and attach it manually if needed.` : "";
  if (result.resumeUploadFields > 0) updateUploadStatus(`Manual upload required: found ${result.resumeUploadFields} resume upload field(s). Browser security usually blocks extensions from assigning a local file path, so download the tailored resume and attach it yourself.`);
  message(`Filled ${result.filled.length} field(s). ${result.skipped.length} skipped for manual review.${uploadHint} Final submission is manual.`);
}

async function downloadTailoredResume(format) {
  const { extensionToken, autofillPlan } = await chrome.storage.local.get(["extensionToken", "autofillPlan"]);
  if (!extensionToken) return message("Pair the extension again before downloading a tailored resume.");
  if (!autofillPlan?.application_id) return message("Load an autofill plan first so Apply Wise knows which application resume to download.");
  const response = await fetchWithRetry(`${apiUrl}/extension/applications/${autofillPlan.application_id}/resume-download?format=${format}`, {
    headers: { Authorization: `Bearer ${extensionToken}` },
  }, { retries: 1, timeoutMs: 20000 });
  if (!response.ok) return message(response.status === 401 ? "Download failed because the extension pairing expired. Generate a fresh code in Apply Wise Settings and pair again." : `Could not download tailored resume: ${await responseMessage(response)}`);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `tailored-resume.${format}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message(`Downloaded ${filename}. Attach it to the resume upload field manually, then review and submit manually.`);
}

function showPaired(paired) {
  document.getElementById("pairing").hidden = paired;
  document.getElementById("capture").hidden = !paired;
}

function message(value) { document.getElementById("message").textContent = value; }

function updateQualityPreview() {
  const payload = Object.fromEntries(fields.map((field) => [field, document.getElementById(field).value.trim()]));
  const list = document.getElementById("quality-list");
  list.replaceChildren();
  for (const item of captureQuality(payload)) {
    const row = document.createElement("li");
    row.className = item.ready ? "ready" : "blocked";
    row.textContent = `${item.ready ? "Ready" : "Needs review"}: ${item.label}`;
    list.appendChild(row);
  }
}

function captureQuality(payload) {
  return [
    { label: "Job title", ready: Boolean(payload.title) },
    { label: "Company", ready: Boolean(payload.company) },
    { label: "Job URL", ready: Boolean(payload.url) && /^https?:\/\//.test(payload.url) },
    { label: "Description has at least 40 characters", ready: payload.description.length >= 40 },
    { label: "Description has useful detail", ready: payload.description.length >= 250 },
  ];
}

function truncate(value, length) {
  return value && value.length > length ? `${value.slice(0, length)}...` : value;
}

function updateUploadStatus(value) {
  const section = document.getElementById("upload-status");
  const text = document.getElementById("upload-status-message");
  if (!section || !text) return;
  text.textContent = value;
  section.hidden = false;
}

function extractPage() {
  const text = document.body.innerText;
  const meta = (name) => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content ?? "";
  const clean = (value) => (value ?? "").replace(/\s+/g, " ").trim();
  const firstText = (...selectors) => selectors.map((selector) => clean(document.querySelector(selector)?.innerText)).find(Boolean) ?? "";
  const firstAttr = (attribute, ...selectors) => selectors.map((selector) => clean(document.querySelector(selector)?.getAttribute(attribute))).find(Boolean) ?? "";
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap((script) => {
      try {
        const parsed = JSON.parse(script.textContent || "{}");
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    })
    .find((entry) => entry?.["@type"] === "JobPosting" || entry?.["@type"]?.includes?.("JobPosting"));
  const jsonLdCompany = typeof jsonLd?.hiringOrganization === "object" ? jsonLd.hiringOrganization.name : "";
  const jsonLdLocation = Array.isArray(jsonLd?.jobLocation)
    ? jsonLd.jobLocation.map((item) => item?.address?.addressLocality || item?.address?.addressRegion || item?.address?.addressCountry).filter(Boolean).join(", ")
    : jsonLd?.jobLocation?.address?.addressLocality || jsonLd?.jobLocation?.address?.addressRegion || jsonLd?.jobLocation?.address?.addressCountry || "";
  const jsonLdDescription = clean((jsonLd?.description || "").replace(/<[^>]+>/g, " "));
  const heading = document.querySelector("h1")?.innerText?.trim() ?? document.title.split("|")[0].trim();
  const jobLocation = [...document.querySelectorAll("[class*='location'],[data-testid*='location']")].map((node) => node.innerText).find(Boolean) ?? "";
  const company = jsonLdCompany || meta("og:site_name") || document.querySelector("[class*='company']")?.innerText?.trim() || window.location.hostname;
  const base = {
    extractor: "generic",
    title: clean(jsonLd?.title) || clean(heading),
    company: clean(company),
    location: clean(jsonLdLocation || jobLocation),
    url: window.location.href,
    description: (jsonLdDescription || clean(text)).slice(0, 45000),
  };
  if (window.location.hostname.includes("greenhouse.io")) return {
    ...base,
    extractor: "Greenhouse",
    title: firstText("h1.app-title", "h1"),
    company: firstText(".company-name", "#logo") || company,
    location: firstText(".location", "[class*='location']"),
    description: firstText("#content", ".job__description", ".content") || base.description,
  };
  if (window.location.hostname.includes("lever.co")) return {
    ...base,
    extractor: "Lever",
    title: firstText(".posting-headline h2", "h1"),
    company: firstText(".main-header-logo img", ".posting-categories") || company,
    location: firstText(".posting-categories .location", ".location"),
    description: firstText(".posting-page", ".content") || base.description,
  };
  if (window.location.hostname.includes("linkedin.com")) return {
    ...base,
    extractor: "LinkedIn",
    title: firstText(".job-details-jobs-unified-top-card__job-title", ".top-card-layout__title", "h1"),
    company: firstText(".job-details-jobs-unified-top-card__company-name", ".topcard__org-name-link") || company,
    location: firstText(".job-details-jobs-unified-top-card__primary-description-container", ".topcard__flavor--bullet") || jobLocation,
    description: firstText(".jobs-description__content", ".show-more-less-html__markup") || base.description,
  };
  if (window.location.hostname.includes("indeed.")) return {
    ...base,
    extractor: "Indeed",
    title: firstText('[data-testid="jobsearch-JobInfoHeader-title"]', ".jobsearch-JobInfoHeader-title", "h1") || base.title,
    company: firstText('[data-testid="inlineHeader-companyName"]', '[data-company-name="true"]', ".jobsearch-InlineCompanyRating-companyHeader") || base.company,
    location: firstText('[data-testid="job-location"]', "#jobLocationText", ".jobsearch-JobInfoHeader-subtitle div") || base.location,
    description: firstText("#jobDescriptionText", '[data-testid="jobsearch-JobComponent-description"]') || base.description,
  };
  if (window.location.hostname.includes("naukri.com")) return {
    ...base,
    extractor: "Naukri",
    title: firstText(".styles_jd-header-title__rZwM1", ".jd-header-title", "h1") || base.title,
    company: firstText(".styles_jd-header-comp-name__MvqAI", ".jd-header-comp-name", ".company-name") || base.company,
    location: firstText(".styles_jhc__location__W_pVs", ".location", ".locWdth") || base.location,
    description: firstText(".styles_JDC__dang-inner-html__h0K4t", ".job-desc", ".dang-inner-html") || base.description,
  };
  if (window.location.hostname.includes("myworkdayjobs.com")) return {
    ...base,
    extractor: "Workday",
    title: firstText('[data-automation-id="jobPostingHeader"]', "h1") || base.title,
    company: firstAttr("alt", '[data-automation-id="logo"] img') || base.company,
    location: firstText('[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]') || base.location,
    description: firstText('[data-automation-id="jobPostingDescription"]', '[data-automation-id="jobDescription"]') || base.description,
  };
  if (window.location.hostname.includes("ashbyhq.com")) return {
    ...base,
    extractor: "Ashby",
    title: firstText('[data-testid="posting-title"]', "h1") || base.title,
    company: firstText('[data-testid="nav-company-name"]', "header") || base.company,
    location: firstText('[data-testid="posting-location"]', "[class*='location']") || base.location,
    description: firstText('[data-testid="posting-description"]', "main") || base.description,
  };
  if (window.location.hostname.includes("smartrecruiters.com")) return {
    ...base,
    extractor: "SmartRecruiters",
    title: firstText(".job-title", "h1") || base.title,
    company: firstText(".company-name", "[class*='company']") || base.company,
    location: firstText(".job-location", "[class*='location']") || base.location,
    description: firstText(".job-description", "#st-job-description", "main") || base.description,
  };
  if (window.location.hostname.includes("jobvite.com")) return {
    ...base,
    extractor: "Jobvite",
    title: firstText(".jv-job-detail-title", ".job-title", "h1") || base.title,
    company: firstText(".jv-company-name", "[class*='company']", "header") || base.company,
    location: firstText(".jv-job-detail-meta", ".jv-job-detail-location", "[class*='location']") || base.location,
    description: firstText(".jv-job-detail-description", ".job-description", "main") || base.description,
  };
  if (window.location.hostname.includes("icims.com")) return {
    ...base,
    extractor: "iCIMS",
    title: firstText(".iCIMS_Header .iCIMS_JobHeader h1", ".iCIMS_JobHeader h1", "h1") || base.title,
    company: firstText(".iCIMS_CompanyHeader", "[class*='company']", "header") || base.company,
    location: firstText(".iCIMS_JobHeader-field .iCIMS_JobHeader-fieldValue", "[class*='location']") || base.location,
    description: firstText(".iCIMS_JobContent", ".iCIMS_JobDescription", "main") || base.description,
  };
  if (window.location.hostname.includes("bamboohr.com")) return {
    ...base,
    extractor: "BambooHR",
    title: firstText(".BambooHR-ATS-Jobs-Item h2", ".js-jobs-list .title", "h1") || base.title,
    company: firstText("[class*='company']", "header") || base.company,
    location: firstText(".BambooHR-ATS-Department-Location", ".location", "[class*='location']") || base.location,
    description: firstText(".BambooHR-ATS-board", ".BambooHR-ATS-Job-Description", "main") || base.description,
  };
  if (window.location.hostname.includes("workable.com")) return {
    ...base,
    extractor: "Workable",
    title: firstText('[data-ui="job-title"]', ".job-title", "h1") || base.title,
    company: firstText('[data-ui="company-name"]', "[class*='company']", "header") || base.company,
    location: firstText('[data-ui="job-location"]', ".job-location", "[class*='location']") || base.location,
    description: firstText('[data-ui="job-description"]', ".job-description", "main") || base.description,
  };
  if (/careers|jobs|workfor|recruiting|boards|jobs\\.ashbyhq|jobvite|icims|bamboohr|workable/.test(window.location.hostname + window.location.pathname)) return {
    ...base,
    extractor: "Company career page",
    title: firstText('[data-testid*="title"]', '[class*="job-title"]', '[class*="posting-title"]', "h1") || base.title,
    company: firstText('[data-testid*="company"]', '[class*="company"]', "header") || base.company,
    location: firstText('[data-testid*="location"]', '[class*="location"]', '[class*="job-location"]') || base.location,
    description: firstText('[data-testid*="description"]', '[class*="description"]', '[class*="job-description"]', '[class*="posting-description"]', "main") || base.description,
  };
  return base;
}

function detectApplicationFields() {
  const classify = (element) => {
    const haystack = [
      element.name, element.id, element.type, element.autocomplete,
      element.getAttribute("aria-label"), element.getAttribute("data-automation-id"), element.getAttribute("data-qa"), element.getAttribute("data-testid"), element.placeholder,
      element.labels?.[0]?.innerText,
    ].filter(Boolean).join(" ").toLowerCase();
    const rules = [
      ["resume upload", /resume|cv|curriculum/],
      ["cover letter", /cover.?letter/],
      ["full name", /full.?name|candidate.?name|applicant.?name/],
      ["first name", /first.?name|given.?name/],
      ["last name", /last.?name|family.?name|surname/],
      ["email", /e-?mail/],
      ["phone", /phone|mobile|telephone/],
      ["location", /location|city|address/],
      ["linkedin", /linkedin/],
      ["portfolio", /portfolio|website|github/],
      ["skills", /skills?|technologies|tools/],
      ["work experience", /experience|employment|work.?history/],
      ["education", /education|degree|college|university/],
      ["expected salary", /expected.?salary|salary.?expectation|ctc/],
      ["notice period", /notice.?period|availability|start.?date/],
      ["current company", /current.?company|employer/],
      ["current role", /current.?role|current.?title|job.?title/],
      ["work authorization", /authori[sz]|sponsor|visa/],
      ["pronouns", /pronouns?/],
    ];
    return rules.find(([, pattern]) => pattern.test(haystack))?.[0] ?? null;
  };
  return [...document.querySelectorAll("input, textarea, select")]
    .map((element) => ({ kind: element.type === "file" ? "resume upload" : classify(element), label: element.labels?.[0]?.innerText?.trim() || element.getAttribute("aria-label") || element.placeholder || element.name || element.id || element.type, type: element.type || element.tagName.toLowerCase() }))
    .filter((field) => field.kind)
    .slice(0, 30);
}

function fillApplicationFields(fields) {
  const aliases = {
    full_name: [/full.?name|candidate.?name|applicant.?name/],
    first_name: [/first.?name|given.?name/],
    last_name: [/last.?name|family.?name|surname/],
    email: [/e-?mail/],
    phone: [/phone|mobile|telephone/],
    location: [/location|city|address/],
    linkedin: [/linkedin/],
    github: [/github/],
    portfolio: [/portfolio|website|personal.?site/],
    work_experience: [/experience|employment|work.?history/],
    education: [/education|degree|college|university/],
    skills: [/skills?|technologies|tools/],
    notice_period: [/notice.?period|availability|start.?date/],
    expected_salary: [/expected.?salary|salary.?expectation|ctc/],
    current_company: [/current.?company|employer/],
    current_role: [/current.?role|current.?title|job.?title/],
    work_authorization: [/authori[sz]|sponsor|visa/],
    pronouns: [/pronouns?/],
    cover_letter: [/cover.?letter/],
  };
  const filled = [];
  const skipped = [];
  const elements = [...document.querySelectorAll("input, textarea, select")];
  const resumeUploadFields = elements.filter((element) => element.type === "file" && /resume|cv|curriculum/i.test(fieldHaystack(element))).length;
  for (const field of fields) {
    if (field.field_key === "resume_file") {
      skipped.push({ field_key: field.field_key, reason: "Browsers do not allow extensions to set local file paths directly." });
      continue;
    }
    if (!String(field.value || "").trim()) {
      skipped.push({ field_key: field.field_key, reason: "No reviewed value is available; fill manually if required." });
      continue;
    }
    const element = elements.find((candidate) => isFillable(candidate) && (aliases[field.field_key] || []).some((pattern) => pattern.test(fieldHaystack(candidate))));
    if (!element) {
      skipped.push({ field_key: field.field_key, reason: "No matching field detected." });
      continue;
    }
    if (element.tagName === "SELECT") {
      const matched = matchSelectOption(element, field.value);
      if (!matched) {
        skipped.push({ field_key: field.field_key, reason: "Select option needs manual choice." });
        continue;
      }
      element.value = matched.value;
    } else if (["checkbox", "radio"].includes(element.type)) {
      skipped.push({ field_key: field.field_key, reason: "Checkbox or radio group needs manual confirmation." });
      continue;
    } else {
      setNativeValue(element, field.value);
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    filled.push({ field_key: field.field_key, label: field.label });
  }
  return { filled, skipped, resumeUploadFields, manualFinalSubmissionRequired: true };
}

function isFillable(element) {
  if (element.type === "file" || element.disabled || element.readOnly) return false;
  if (element.offsetParent === null && element.tagName !== "SELECT") return false;
  return true;
}

function matchSelectOption(element, value) {
  const expected = normalizeOption(value);
  return [...element.options].find((option) => normalizeOption(option.value) === expected)
    || [...element.options].find((option) => normalizeOption(option.textContent) === expected)
    || [...element.options].find((option) => normalizeOption(option.textContent).includes(expected) && expected.length >= 3);
}

function normalizeOption(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function setNativeValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  if (element.value !== value) element.value = value;
}

function fieldHaystack(element) {
  return [
    element.name, element.id, element.type, element.autocomplete,
    element.getAttribute("aria-label"), element.getAttribute("data-automation-id"), element.getAttribute("data-qa"), element.getAttribute("data-testid"), element.placeholder,
    element.labels?.[0]?.innerText,
  ].filter(Boolean).join(" ").toLowerCase();
}
