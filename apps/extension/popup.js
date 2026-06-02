const apiUrl = "https://jobsearchautomation-production.up.railway.app/api/v1";
const fields = ["title", "company", "location", "url", "description"];

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("pair").addEventListener("click", pair);
  document.getElementById("send").addEventListener("click", send);
  document.getElementById("inspect-form").addEventListener("click", inspectForm);
  document.getElementById("unpair").addEventListener("click", unpair);
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
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPage });
  for (const field of fields) document.getElementById(field).value = result[field] ?? "";
}

async function send() {
  const { extensionToken } = await chrome.storage.local.get("extensionToken");
  const payload = Object.fromEntries(fields.map((field) => [field, document.getElementById(field).value.trim()]));
  const response = await fetch(`${apiUrl}/extension/jobs/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${extensionToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return message("Capture failed. Check the reviewed fields and confirm your resume is uploaded.");
  const body = await response.json();
  message(`Captured with a ${body.match_score}% resume match. Open Apply Wise to save or prepare this role.`);
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

function extractPage() {
  const text = document.body.innerText;
  const meta = (name) => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content ?? "";
  const heading = document.querySelector("h1")?.innerText?.trim() ?? document.title.split("|")[0].trim();
  const jobLocation = [...document.querySelectorAll("[class*='location'],[data-testid*='location']")].map((node) => node.innerText).find(Boolean) ?? "";
  const company = meta("og:site_name") || document.querySelector("[class*='company']")?.innerText?.trim() || window.location.hostname;
  return { title: heading, company, location: jobLocation, url: window.location.href, description: text.slice(0, 45000) };
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
