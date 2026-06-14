const assert = require("assert");
const fs = require("fs");
const path = require("path");

const extensionRoot = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
const popupHtml = fs.readFileSync(path.join(extensionRoot, "popup.html"), "utf8");
const popupJs = fs.readFileSync(path.join(extensionRoot, "popup.js"), "utf8");

assert.strictEqual(manifest.manifest_version, 3);
assert.strictEqual(manifest.version, "0.3.0");
assert.deepStrictEqual(manifest.action, {
  default_title: "Capture job with Apply Wise",
  default_popup: "popup.html",
});

for (const permission of ["activeTab", "storage", "scripting"]) {
  assert(manifest.permissions.includes(permission), `Missing permission: ${permission}`);
}

for (const hostPermission of ["https://www.linkedin.com/*", "https://linkedin.com/*"]) {
  assert(manifest.host_permissions.includes(hostPermission), `Missing host permission: ${hostPermission}`);
}

assert(!manifest.content_scripts, "This extension intentionally uses activeTab + chrome.scripting instead of persistent content_scripts.");
assert(popupJs.includes("chrome.tabs.query({ active: true, currentWindow: true })"), "Popup must read the active browser tab.");
assert(popupJs.includes("chrome.scripting.executeScript"), "Popup must inject extraction into the active tab DOM.");
assert(popupJs.includes("func: extractPage"), "Popup must execute the page extractor in the active tab.");

for (const id of [
  "extension-version",
  "api-url",
  "save-api-url",
  "api-status",
  "pair",
  "send",
  "refresh",
  "diagnostics",
  "extraction-diagnostics",
  "debug-report",
  "copy-debug",
  "inspect-form",
  "load-autofill",
  "fill-reviewed",
  "download-resume-pdf",
  "download-resume-docx",
  "unpair",
  "message",
]) {
  assert(popupHtml.includes(`id="${id}"`), `Missing popup element id: ${id}`);
}

for (const fieldId of ["title", "company", "location", "url", "description"]) {
  assert(popupHtml.includes(`id="${fieldId}"`), `Manual fallback field is missing: ${fieldId}`);
}

assert(
  popupJs.includes("sendButton.disabled = quality.some((item) => !item.ready && item.blocking)"),
  "Send button must only be disabled by blocking validation failures.",
);
assert(
  popupJs.includes('{ label: "Location", ready: Boolean(payload.location), blocking: false }'),
  "Location must remain optional for LinkedIn captures.",
);
assert(
  popupJs.includes('{ label: "Description has at least 40 characters", ready: description.length >= 40, blocking: true }'),
  "Short descriptions must block sending.",
);
assert(
  popupJs.includes('{ label: "Description has useful detail", ready: description.length >= 250, blocking: false }'),
  "Useful-detail warnings must not block manually corrected captures.",
);
assert(
  popupJs.includes("if (diagnostics) diagnostics.hidden = false"),
  "Debug report updates must reveal the diagnostics/debug section.",
);

console.log("Extension manifest and popup contract tests passed.");
