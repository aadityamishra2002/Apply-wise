const apiUrl = "https://jobsearchautomation-production.up.railway.app/api/v1";
const fields = ["title", "company", "location", "url", "description"];

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("pair").addEventListener("click", pair);
  document.getElementById("send").addEventListener("click", send);
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
