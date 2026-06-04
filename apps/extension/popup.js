const apiUrl = "https://jobsearchautomation-production.up.railway.app/api/v1";
const fields = ["title", "company", "location", "url", "description"];

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("pair").addEventListener("click", pair);
  document.getElementById("send").addEventListener("click", send);
  document.getElementById("refresh").addEventListener("click", extract);
  document.getElementById("inspect-form").addEventListener("click", inspectForm);
  document.getElementById("unpair").addEventListener("click", unpair);
  for (const field of fields) document.getElementById(field).addEventListener("input", updateQualityPreview);
  const { extensionToken } = await chrome.storage.local.get("extensionToken");
  showPaired(Boolean(extensionToken));
  if (extensionToken) await extract();
});

async function pair() {
  const code = document.getElementById("code").value.trim();
  const response = await fetch(`${apiUrl}/extension/pair`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
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
  const response = await fetch(`${apiUrl}/extension/jobs/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${extensionToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return message(`Capture failed: ${await responseMessage(response)}`);
  const body = await response.json();
  message(`Captured with a ${body.match_score}% resume match. Open Apply Wise to save or prepare this role.`);
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
    item.textContent = `${field.label} (${field.kind})`;
    list.appendChild(item);
  }
  document.getElementById("form-preview").hidden = false;
  message(result.length ? `Found ${result.length} application fields. Preview them before any future assisted fill.` : "No common application fields were detected on this page.");
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

function extractPage() {
  const text = document.body.innerText;
  const meta = (name) => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content ?? "";
  const firstText = (...selectors) => selectors.map((selector) => document.querySelector(selector)?.innerText?.trim()).find(Boolean) ?? "";
  const heading = document.querySelector("h1")?.innerText?.trim() ?? document.title.split("|")[0].trim();
  const jobLocation = [...document.querySelectorAll("[class*='location'],[data-testid*='location']")].map((node) => node.innerText).find(Boolean) ?? "";
  const company = meta("og:site_name") || document.querySelector("[class*='company']")?.innerText?.trim() || window.location.hostname;
  const base = { extractor: "generic", title: heading, company, location: jobLocation, url: window.location.href, description: text.slice(0, 45000) };
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
  return base;
}

function detectApplicationFields() {
  const classify = (element) => {
    const haystack = [
      element.name, element.id, element.type, element.autocomplete,
      element.getAttribute("aria-label"), element.placeholder,
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
      ["work authorization", /authori[sz]|sponsor|visa/],
    ];
    return rules.find(([, pattern]) => pattern.test(haystack))?.[0] ?? null;
  };
  return [...document.querySelectorAll("input, textarea, select")]
    .map((element) => ({ kind: classify(element), label: element.labels?.[0]?.innerText?.trim() || element.getAttribute("aria-label") || element.placeholder || element.name || element.id || element.type }))
    .filter((field) => field.kind)
    .slice(0, 30);
}
