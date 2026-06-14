const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const popupSource = fs.readFileSync(path.join(__dirname, "..", "popup.js"), "utf8");
const extractPageSource = extractFunction(popupSource, "extractPage");
const waitForLinkedInJobContentSource = extractFunction(popupSource, "waitForLinkedInJobContent");
const captureQualitySource = extractFunction(popupSource, "captureQuality");

function extractFunction(source, name) {
  const functionStart = source.indexOf(`function ${name}`);
  const asyncStart = source.lastIndexOf("async ", functionStart);
  const start = asyncStart >= 0 && source.slice(asyncStart, functionStart) === "async " ? asyncStart : functionStart;
  if (start < 0) throw new Error(`Could not find ${name}`);
  const openParen = source.indexOf("(", start);
  let parenDepth = 0;
  let closeParen = -1;
  for (let index = openParen; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    if (source[index] === ")") parenDepth -= 1;
    if (parenDepth === 0) {
      closeParen = index;
      break;
    }
  }
  const firstBrace = source.indexOf("{", closeParen);
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
    content: attrs.content ?? null,
    getAttribute: (name) => attrs[name] ?? null,
  };
}

function fakeDocument({ selectors = {}, all = {}, bodyText = "", title = "", metas = {}, scripts = [] }) {
  return {
    title,
    readyState: "complete",
    body: node(bodyText),
    querySelector: (selector) => {
      const metaMatch = selector.match(/meta\[(?:property|name)="([^"]+)"\]/);
      if (metaMatch && metas[metaMatch[1]]) return node("", { content: metas[metaMatch[1]] });
      return selectors[selector] ?? null;
    },
    querySelectorAll: (selector) => {
      if (selector === 'script[type="application/ld+json"]') return scripts.map((script) => node(script));
      if (selector.includes(",")) {
        return selector.split(",").map((part) => part.trim()).flatMap((part) => all[part] ?? (selectors[part] ? [selectors[part]] : []));
      }
      return all[selector] ?? (selectors[selector] ? [selectors[selector]] : []);
    },
  };
}

function fixtureDocument(name) {
  const html = fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
  const selectors = {};
  for (const match of html.matchAll(/data-selector="([^"]+)"[^>]*>([\s\S]*?)<\/[^>]+>/g)) {
    selectors[match[1]] = node(stripTags(match[2]));
  }
  const metas = {};
  for (const match of html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"[^>]*>/g)) {
    metas[match[1]] = decode(match[2]);
  }
  const scripts = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1].trim());
  const title = stripTags((html.match(/<title>([\s\S]*?)<\/title>/) || [null, ""])[1]);
  return { selectors, metas, scripts, bodyText: stripTags(html), title };
}

function stripTags(value) {
  return decode(
    String(value || "")
      .replace(/<[^>]+>/g, "\n")
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
  );
}

function decode(value) {
  return String(value || "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

async function runExtraction(url, documentConfig) {
  const parsedUrl = new URL(url);
  const context = {
    URL,
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    document: fakeDocument(documentConfig),
    window: { location: parsedUrl },
    result: null,
  };
  vm.createContext(context);
  await vm.runInContext(`${waitForLinkedInJobContentSource}; ${extractPageSource}; (async () => { result = await extractPage(); })();`, context);
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

async function main() {
const fixtureStandard = await runExtraction("https://www.linkedin.com/jobs/view/4425607893/", fixtureDocument("linkedin-standard.html"));
assert.strictEqual(fixtureStandard.extractor, "LinkedIn");
assert.strictEqual(fixtureStandard.title, "AI Senior Software Engineer");
assert.strictEqual(fixtureStandard.company, "Sopra Steria");
assert.strictEqual(fixtureStandard.location, "Noida, Uttar Pradesh, India");
assert(fixtureStandard.description.includes("Responsibilities include secure agent orchestration"));
assert(fixtureStandard.extractionLayer.includes("selectors"));
assertNoLinkedInNoise(fixtureStandard.description);

const fixtureMeta = await runExtraction("https://www.linkedin.com/jobs/view/4425607893/", fixtureDocument("linkedin-meta.html"));
assert.strictEqual(fixtureMeta.title, "AI Senior Software Engineer");
assert.strictEqual(fixtureMeta.company, "Sopra Steria");
assert(fixtureMeta.description.includes("Develop AI software for production platforms"));
assert(fixtureMeta.extractionLayer.includes("meta_tags"));

const fixtureJsonLd = await runExtraction("https://www.linkedin.com/jobs/view/4425607893/", fixtureDocument("linkedin-jsonld.html"));
assert.strictEqual(fixtureJsonLd.title, "AI Senior Software Engineer");
assert.strictEqual(fixtureJsonLd.company, "Sopra Steria");
assert(fixtureJsonLd.location.includes("Noida"));
assert(fixtureJsonLd.description.includes("Build AI services"));
assert(fixtureJsonLd.extractionLayer.includes("json_ld"));

const fixtureVisible = await runExtraction("https://www.linkedin.com/jobs/view/4424855234/", fixtureDocument("linkedin-visible-text.html"));
assert.strictEqual(fixtureVisible.title, "AI/ML Engineer");
assert.strictEqual(fixtureVisible.company, "PrismHR");
assert.strictEqual(fixtureVisible.location, "Noida, Uttar Pradesh, India");
assert(fixtureVisible.description.includes("highly skilled AI/ML Engineer"));
assert(fixtureVisible.extractionLayer.includes("visible_text_heuristic"));

const fixtureManual = await runExtraction("https://www.linkedin.com/jobs/view/4425607893/", fixtureDocument("linkedin-manual-fallback.html"));
assert.strictEqual(fixtureManual.extractor, "LinkedIn");
assert.strictEqual(fixtureManual.title, "");
assert.strictEqual(fixtureManual.company, "");
assert.strictEqual(fixtureManual.description, "");
assert.strictEqual(fixtureManual.extractionLayer, "manual_required");
const manualQuality = captureQuality(fixtureManual);
assert(manualQuality.filter((item) => !item.ready && item.blocking).map((item) => item.label).includes("Job title"));
assert(manualQuality.filter((item) => !item.ready && item.blocking).map((item) => item.label).includes("Company"));

const linkedInView = await runExtraction("https://www.linkedin.com/jobs/view/4425607893/", {
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

const linkedInCollection = await runExtraction("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4425607893", {
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

const linkedInMissingCompany = await runExtraction("https://www.linkedin.com/jobs/view/1/", {
  bodyText: "LinkedIn shell",
  selectors: {
    ".job-details-jobs-unified-top-card__job-title h1": node("AI Engineer"),
    ".job-details-jobs-unified-top-card__company-name a": node("www.linkedin.com"),
    ".jobs-description__content .jobs-box__html-content": node("Actual job description with enough useful role detail for validation."),
  },
});

assert.strictEqual(linkedInMissingCompany.company, "");

const realDomFallbackText = `
  LinkedIn
  AI Senior Software Engineer
  Sopra Steria
  Noida, Uttar Pradesh, India
  4 days ago
  Over 200 applicants
  About the job
  Company Description
  About Sopra Steria
  Job Description
  Role Mission
  Develop and integrate AI-driven capabilities into the QA Evolution platform.
  Ensure secure, auditable, and governed execution of AI agents.
  Qualifications
  Python, Java, LLMs, RAG, embeddings, vector databases, and CI/CD.
  Seniority level
  Mid-Senior level
  Similar jobs
  Other company role
`;

const linkedInRealDomFallback = await runExtraction("https://www.linkedin.com/jobs/view/4425607893/", {
  title: "AI Senior Software Engineer | Sopra Steria | LinkedIn",
  bodyText: realDomFallbackText,
  selectors: {
    main: node(realDomFallbackText),
  },
});

assert.strictEqual(linkedInRealDomFallback.title, "AI Senior Software Engineer");
assert.strictEqual(linkedInRealDomFallback.company, "Sopra Steria");
assert.strictEqual(linkedInRealDomFallback.location, "Noida, Uttar Pradesh, India");
assert(linkedInRealDomFallback.description.includes("Role Mission"));
assertNoLinkedInNoise(linkedInRealDomFallback.description);
assert(linkedInRealDomFallback.diagnostics.some((item) => item.field === "candidate container first 500 chars"));
assert(linkedInRealDomFallback.diagnostics.some((item) => item.field === "title selector matches"));
assert(linkedInRealDomFallback.diagnostics.some((item) => item.selector === "candidate text heuristic" || item.selector === "document.title fallback"));

const prismHrVisibleCardText = `
  LinkedIn
  PrismHR
  AI/ML Engineer
  Noida, Uttar Pradesh, India
  3 weeks ago
  43 applicants
  Apply
  Save
  About the job
  We are seeking a highly skilled AI/ML Engineer to design, develop, and deploy machine learning models and AI-driven solutions that enhance business processes and product capabilities.
  Key Responsibilities:
  Model Development: Build, train, and optimise machine learning models for predictive analytics, natural language processing, computer vision, and other AI applications.
  Data Engineering: Preprocess, clean, and structure large datasets for model training and evaluation.
  Required Skills & Qualifications:
  Strong proficiency in Python, TensorFlow, PyTorch, and ML libraries.
  Seniority level
  Mid-Senior level
  Similar jobs
  AI / ML Engineer
`;

const prismHrVisibleCard = await runExtraction("https://www.linkedin.com/jobs/view/4424855234/", {
  title: "AI/ML Engineer | PrismHR | LinkedIn",
  bodyText: prismHrVisibleCardText,
  selectors: {
    main: node(prismHrVisibleCardText),
  },
});

assert.strictEqual(prismHrVisibleCard.title, "AI/ML Engineer");
assert.strictEqual(prismHrVisibleCard.company, "PrismHR");
assert.strictEqual(prismHrVisibleCard.location, "Noida, Uttar Pradesh, India");
assert(prismHrVisibleCard.description.includes("We are seeking a highly skilled AI/ML Engineer"));
assertNoLinkedInNoise(prismHrVisibleCard.description);
assert(prismHrVisibleCard.diagnostics.some((item) => item.field === "document.body.innerText length"));
assert(prismHrVisibleCard.diagnostics.some((item) => item.field === "document.body.innerText first 1000 chars"));

const naukri = await runExtraction("https://www.naukri.com/job-listings-ai-engineer-example", {
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

const workday = await runExtraction("https://example.wd3.myworkdayjobs.com/jobs/job/software-engineer", {
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

const genericCareer = await runExtraction("https://careers.example.com/jobs/123-ai-platform-engineer", {
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

const manualFallbackReadyQuality = captureQuality({
  title: "AI Senior Software Engineer",
  company: "Sopra Steria",
  location: "",
  url: "https://www.linkedin.com/jobs/view/4425607893/",
  description: "Develop AI services and production software with Python and cloud platforms.",
});
const manualFallbackBlocking = manualFallbackReadyQuality.filter((item) => !item.ready && item.blocking).map((item) => item.label);
assert.strictEqual(manualFallbackBlocking.length, 0);
assert(manualFallbackReadyQuality.find((item) => item.label === "Location" && !item.blocking));
assert(manualFallbackReadyQuality.find((item) => item.label === "Description has useful detail" && !item.blocking));

console.log("Extension extraction regression tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
