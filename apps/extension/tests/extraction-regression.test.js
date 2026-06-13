const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const popupSource = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");
const extractPageSource = extractFunction(popupSource, "extractPage");
const captureQualitySource = extractFunction(popupSource, "captureQuality");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`Could not find ${name}`);
  const firstBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = firstBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}`);
}

function node(text, attrs = {}) {
  return {
    innerText: text,
    textContent: text,
    getAttribute: (name) => attrs[name] ?? null,
  };
}

function fakeDocument({ selectors = {}, all = {}, bodyText = "", title = "" }) {
  return {
    title,
    body: node(bodyText),
    querySelector: (selector) => selectors[selector] ?? null,
    querySelectorAll: (selector) => all[selector] ?? [],
  };
}

function runExtraction(url, documentConfig) {
  const parsedUrl = new URL(url);
  const context = {
    URL,
    document: fakeDocument(documentConfig),
    window: { location: parsedUrl },
    result: null,
  };
  vm.createContext(context);
  vm.runInContext(`${extractPageSource}; result = extractPage();`, context);
  return context.result;
}

function assertNoLinkedInNoise(description) {
  assert(!/Similar jobs|Recommended jobs|Get notified|Notifications|Premium|Language selector|Footer/i.test(description), description);
}

function captureQuality(payload) {
  const context = { result: null, payload };
  vm.createContext(context);
  vm.runInContext(`${captureQualitySource}; result = captureQuality(payload);`, context);
  return context.result;
}

const linkedInDescription = `
  Company Description
  About Sopra Steria
  Sopra Steria is a major Tech player in Europe.
  Job Description
  The world is how we shape it.
  Role Mission
  Develop and integrate AI-driven capabilities into the QA Evolution platform.
  Ensure secure, auditable, and governed execution of AI agents.
  Experience with one agent framework: PydanticAI, LangChain, AutoGen, OpenAI Agents SDK.
  Total Experience Expected: 04-08 years
  Qualifications
  B Tech in computer science
  Seniority level
  Not Applicable
  Similar jobs
  Senior AI Engineer at Another Company
`;

const linkedInView = runExtraction("https://www.linkedin.com/jobs/view/4425607893/", {
  title: "AI Senior Software Engineer | LinkedIn",
  bodyText: "LinkedIn navigation Notifications Premium Similar jobs footer text",
  selectors: {
    ".job-details-jobs-unified-top-card__job-title h1": node("AI Senior Software Engineer"),
    ".job-details-jobs-unified-top-card__company-name a": node("Sopra Steria"),
    ".job-details-jobs-unified-top-card__primary-description-container .tvm__text--low-emphasis": node("Sopra Steria · Noida, Uttar Pradesh, India · 4 days ago · Over 200 applicants"),
    ".jobs-description__content .jobs-box__html-content": node(linkedInDescription),
    h1: node("AI Senior Software Engineer"),
  },
});

assert.strictEqual(linkedInView.extractor, "LinkedIn");
assert.strictEqual(linkedInView.title, "AI Senior Software Engineer");
assert.strictEqual(linkedInView.company, "Sopra Steria");
assert.strictEqual(linkedInView.location, "Noida, Uttar Pradesh, India");
assert(linkedInView.description.includes("Role Mission"));
assert(!linkedInView.description.includes("Seniority level"));
assertNoLinkedInNoise(linkedInView.description);
assert(linkedInView.diagnostics.some((item) => item.field === "title" && item.selector.includes("job-title")));
assert(linkedInView.diagnostics.some((item) => item.field === "description" && item.selector.includes("jobs-description")));

const linkedInCollection = runExtraction("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4425607893", {
  bodyText: "LinkedIn feed shell and recommendations",
  selectors: {
    ".jobs-unified-top-card__job-title": node("AI Senior Software Engineer"),
    ".jobs-unified-top-card__company-name a": node("Sopra Steria"),
    ".jobs-unified-top-card__bullet": node("Noida, Uttar Pradesh, India"),
    ".jobs-description-content__text": node("Job Description Build governed AI agents and LLM integrations. Qualifications Python and Java."),
  },
});

assert.strictEqual(linkedInCollection.title, "AI Senior Software Engineer");
assert.strictEqual(linkedInCollection.company, "Sopra Steria");
assert.strictEqual(linkedInCollection.location, "Noida, Uttar Pradesh, India");
assertNoLinkedInNoise(linkedInCollection.description);

const linkedInMissingCompany = runExtraction("https://www.linkedin.com/jobs/view/1/", {
  bodyText: "LinkedIn shell",
  selectors: {
    ".job-details-jobs-unified-top-card__job-title h1": node("AI Engineer"),
    ".job-details-jobs-unified-top-card__company-name a": node("www.linkedin.com"),
    ".jobs-description__content .jobs-box__html-content": node("Actual job description with enough useful role detail for validation."),
  },
});

assert.strictEqual(linkedInMissingCompany.company, "");

const naukri = runExtraction("https://www.naukri.com/job-listings-ai-engineer-example", {
  selectors: {
    ".styles_jd-header-title__rZwM1": node("AI Engineer"),
    ".styles_jd-header-comp-name__MvqAI": node("Example Tech"),
    ".styles_jhc__location__W_pVs": node("Bengaluru"),
    ".styles_JDC__dang-inner-html__h0K4t": node("Build AI features using Python and cloud services."),
  },
});

assert.strictEqual(naukri.extractor, "Naukri");
assert.strictEqual(naukri.title, "AI Engineer");
assert.strictEqual(naukri.company, "Example Tech");
assert.strictEqual(naukri.location, "Bengaluru");

const workday = runExtraction("https://example.wd3.myworkdayjobs.com/jobs/job/software-engineer", {
  selectors: {
    '[data-automation-id="jobPostingHeader"]': node("Software Engineer"),
    '[data-automation-id="logo"] img': node("", { alt: "Example Workday Co" }),
    '[data-automation-id="locations"]': node("Pune, India"),
    '[data-automation-id="jobPostingDescription"]': node("Develop production software and collaborate with product teams."),
  },
});

assert.strictEqual(workday.extractor, "Workday");
assert.strictEqual(workday.title, "Software Engineer");
assert.strictEqual(workday.company, "Example Workday Co");
assert.strictEqual(workday.location, "Pune, India");

const genericCareer = runExtraction("https://careers.example.com/jobs/123-ai-platform-engineer", {
  selectors: {
    '[class*="job-title"]': node("AI Platform Engineer"),
    '[class*="company"]': node("Example Careers"),
    '[class*="job-location"]': node("Remote - India"),
    '[class*="job-description"]': node("Build AI platform services, integrate LLM APIs, and operate production systems with Python."),
  },
});

assert.strictEqual(genericCareer.extractor, "Company career page");
assert.strictEqual(genericCareer.title, "AI Platform Engineer");
assert.strictEqual(genericCareer.company, "Example Careers");
assert.strictEqual(genericCareer.location, "Remote - India");
assert(genericCareer.description.includes("integrate LLM APIs"));

const blockedQuality = captureQuality({
  title: "",
  company: "",
  location: "",
  url: "https://www.linkedin.com/jobs/view/4425607893/",
  description: "LinkedIn Premium Notifications Similar jobs",
});
const blockedLabels = blockedQuality.filter((item) => !item.ready).map((item) => item.label);
assert(blockedLabels.includes("Job title"));
assert(blockedLabels.includes("Company"));
assert(blockedLabels.includes("Location"));
assert(blockedLabels.includes("Description has useful detail"));
assert(blockedLabels.includes("Description is focused on the job"));

console.log("Extension extraction regression tests passed.");
