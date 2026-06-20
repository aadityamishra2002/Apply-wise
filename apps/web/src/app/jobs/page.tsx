"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bookmark, Check, Copy, Download, FileText, LoaderCircle, Mail, MapPin, Plus, Search, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MatchRing, Pill } from "@/components/ui";
import {
  captureManualJob,
  createJobCoverLetter,
  createJobResumeVersion,
  downloadCoverLetter,
  downloadResumeVersion,
  getAccessToken,
  importJobUrl,
  loadResumeProfile,
  loadJobRecommendations,
  saveJob,
  updateJobApproval,
  type CoverLetterRecord,
  type JobRecommendation,
  type ManualJob,
  type ResumeVersionDetail,
} from "@/lib/api";

const emptyManualJob: ManualJob = { title: "", company: "", location: "", url: "", description: "" };

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRecommendation[]>([]);
  const [selected, setSelected] = useState<JobRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [fitFilter, setFitFilter] = useState<"all" | "high_fit">("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [manualJob, setManualJob] = useState(emptyManualJob);
  const [jobUrl, setJobUrl] = useState("");
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [generatedResume, setGeneratedResume] = useState<ResumeVersionDetail | null>(null);
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState<CoverLetterRecord | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<"resume" | "cover" | null>(null);

  const sources = Array.from(new Set(jobs.map((job) => job.source))).sort();
  const visibleJobs = jobs.filter((job) => {
    if (fitFilter === "high_fit" && !job.high_fit) return false;
    if (sourceFilter !== "all" && job.source !== sourceFilter) return false;
    if (remoteOnly && !`${job.location} ${job.work_mode}`.toLowerCase().includes("remote")) return false;
    return true;
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      setError("Log in again to load jobs and captured roles.");
      return;
    }
    void Promise.all([loadResumeProfile(token).catch(() => null), loadJobRecommendations(token)])
      .then(([profile, items]) => {
        setHasResume(Boolean(profile));
        setJobs(items);
        setSelected(items[0] ?? null);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setGeneratedResume(null);
    setGeneratedCoverLetter(null);
    setGenerationStatus(null);
    setPreparing(null);
  }, [selected?.id]);

  async function searchJobs() {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    setSearchAttempted(true);
    try {
      const items = await loadJobRecommendations(token, query, location);
      setJobs(items);
      setSelected(items[0] ?? null);
      setFitFilter("all");
      setSourceFilter("all");
      setRemoteOnly(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load job recommendations.");
    } finally {
      setLoading(false);
    }
  }

  async function persistSavedJob(jobId: string) {
    const token = getAccessToken();
    if (!token) return;
    try {
      const application = await saveJob(jobId, token);
      const markSaved = (job: JobRecommendation) => job.id === jobId ? { ...job, saved: true, application_id: application.id } : job;
      setJobs((current) => current.map(markSaved));
      setSelected((current) => current ? markSaved(current) : current);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this job.");
    }
  }

  async function captureJob() {
    const token = getAccessToken();
    if (!token) return;
    setError(null);
    try {
      const job = await captureManualJob(manualJob, token);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setSelected(job);
      setManualJob(emptyManualJob);
      setShowCapture(false);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Could not capture this job.");
    }
  }

  async function importUrl() {
    const token = getAccessToken();
    if (!token || !jobUrl.trim()) return;
    setError(null);
    try {
      const job = await importJobUrl(jobUrl.trim(), token);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setSelected(job);
      setJobUrl("");
      setShowCapture(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import this job URL.");
    }
  }

  async function decide(jobId: string, approvalStatus: "approved" | "dismissed") {
    const token = getAccessToken();
    if (!token) return;
    await updateJobApproval(jobId, approvalStatus, token);
    setJobs((current) => current.map((job) => job.id === jobId ? { ...job, approval_status: approvalStatus } : job));
    setSelected((current) => current?.id === jobId ? { ...current, approval_status: approvalStatus } : current);
  }

  async function generateResume() {
    const token = getAccessToken();
    if (!token || !selected) return;
    setPreparing("resume");
    setError(null);
    setGenerationStatus(null);
    try {
      const version = await createJobResumeVersion(selected.id, token);
      setGeneratedResume(version);
      setGenerationStatus("Tailored resume generated and stored.");
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "Could not generate a tailored resume.";
      setError(`${message} Confirm your master resume is uploaded and the job has a complete title, company, URL, and description.`);
    } finally {
      setPreparing(null);
    }
  }

  async function generateCoverLetter() {
    const token = getAccessToken();
    if (!token || !selected) return;
    setPreparing("cover");
    setError(null);
    setGenerationStatus(null);
    try {
      const letter = await createJobCoverLetter(selected.id, token);
      setGeneratedCoverLetter(letter);
      setGenerationStatus("Cover letter generated and stored.");
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "Could not generate a cover letter.";
      setError(`${message} Confirm your master resume is uploaded and the job has a complete title, company, URL, and description.`);
    } finally {
      setPreparing(null);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setGenerationStatus(`${label} copied to clipboard.`);
    } catch {
      setError(`Could not copy ${label.toLowerCase()}. Select the preview text and copy manually.`);
    }
  }

  async function downloadGeneratedResume(format: "docx" | "pdf") {
    const token = getAccessToken();
    if (!token || !generatedResume) return;
    try {
      await downloadResumeVersion(generatedResume.id, format, token, generatedResume.quality_warnings.length > 0);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download the tailored resume.");
    }
  }

  async function downloadGeneratedCoverLetter() {
    const token = getAccessToken();
    if (!token || !generatedCoverLetter) return;
    try {
      await downloadCoverLetter(generatedCoverLetter.id, token);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download the cover letter.");
    }
  }

  return (
    <AppShell eyebrow="Job discovery" title="Resume-aware recommendations" actions={<Link className="rounded-lg border border-[#dfe6e2] bg-white px-3 py-2 text-[12px] font-bold text-[#65736f]" href="/applications">Saved jobs ({jobs.filter((job) => job.saved).length})</Link>}>
      <form className="mb-5 grid gap-2 rounded-2xl border border-[#e4e8e3] bg-white p-3 small-shadow sm:grid-cols-[1fr_.7fr_auto]" onSubmit={(event) => { event.preventDefault(); void searchJobs(); }}>
        <input aria-label="Search jobs" className="min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none placeholder:text-[#a0aba8]" onChange={(event) => setQuery(event.target.value)} placeholder="Search roles or keywords, such as Python developer" value={query} />
        <input aria-label="Search location" className="min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none placeholder:text-[#a0aba8]" onChange={(event) => setLocation(event.target.value)} placeholder="Location, such as Remote or Bengaluru" value={location} />
        <button className="flex items-center gap-1.5 rounded-xl bg-[#176b5b] px-4 py-2.5 text-[12px] font-bold text-white" type="submit"><Search size={14} />Search</button>
      </form>

      <div className="mb-5">
        <button className="flex items-center gap-1.5 text-[12px] font-bold text-[#176b5b]" onClick={() => setShowCapture((current) => !current)}><Plus size={14} />{showCapture ? "Close job capture" : "Paste a job from any career page"}</button>
        {showCapture ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-[#e4e8e3] bg-white p-4 small-shadow sm:grid-cols-2">
            <div className="grid gap-2 rounded-xl bg-[#f6f8f5] p-3 sm:col-span-2 sm:grid-cols-[1fr_auto]">
              <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setJobUrl(event.target.value)} placeholder="Import public job URL" value={jobUrl} />
              <button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60" disabled={!jobUrl.trim()} onClick={() => void importUrl()} type="button">Import URL</button>
              <p className="text-[11px] leading-5 text-[#71807c] sm:col-span-2">If a site blocks server-side import, paste the details below or use the browser extension.</p>
            </div>
            <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setManualJob({ ...manualJob, title: event.target.value })} placeholder="Job title" value={manualJob.title} />
            <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setManualJob({ ...manualJob, company: event.target.value })} placeholder="Company (required)" value={manualJob.company} />
            <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setManualJob({ ...manualJob, location: event.target.value })} placeholder="Location" value={manualJob.location} />
            <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setManualJob({ ...manualJob, url: event.target.value })} placeholder="Job page URL" value={manualJob.url} />
            <textarea className="min-h-28 rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px] sm:col-span-2" onChange={(event) => setManualJob({ ...manualJob, description: event.target.value })} placeholder="Paste the job description" value={manualJob.description} />
            <p className="text-[11px] leading-5 text-[#71807c] sm:col-span-2">If a generic career page misses the company, copy it from the page header or employer site and paste it here before scoring.</p>
            <button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={!manualJob.title.trim() || !manualJob.company.trim() || !manualJob.url.trim() || manualJob.description.trim().length < 40} onClick={() => void captureJob()} type="button">Score captured job</button>
          </div>
        ) : null}
      </div>

      {jobs.length ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e4e8e3] bg-white p-3 small-shadow">
          <select className="rounded-lg border border-[#dce7e2] bg-[#fbfcfa] px-3 py-2 text-[12px] font-bold text-[#176b5b]" onChange={(event) => setFitFilter(event.target.value as "all" | "high_fit")} value={fitFilter}>
            <option value="all">All ATS scores</option>
            <option value="high_fit">80+ ATS only</option>
          </select>
          <select className="rounded-lg border border-[#dce7e2] bg-[#fbfcfa] px-3 py-2 text-[12px] font-bold capitalize text-[#176b5b]" onChange={(event) => setSourceFilter(event.target.value)} value={sourceFilter}>
            <option value="all">All sources</option>
            {sources.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg bg-[#f6f8f5] px-3 py-2 text-[12px] font-bold text-[#65736f]"><input checked={remoteOnly} onChange={(event) => setRemoteOnly(event.target.checked)} type="checkbox" />Remote only</label>
          <p className="text-[12px] font-bold text-[#91a09c]">{visibleJobs.length} of {jobs.length} shown</p>
        </div>
      ) : null}

      {error ? <p className="mb-4 rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{error}</p> : null}
      {loading ? (
        <div className="grid min-h-[360px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" /></div>
      ) : jobs.length ? (
        <section className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
          <div className="space-y-3">
            <h2 className="text-[16px] font-bold">{visibleJobs.length} profile-scored roles</h2>
            <p className="text-[12px] font-bold text-[#176b5b]">{jobs.filter((job) => job.high_fit && job.approval_status === "review_required").length} roles in your 80+ ATS review queue</p>
            {visibleJobs.map((job) => (
              <button className={`w-full rounded-2xl border bg-white p-4 text-left ${selected?.id === job.id ? "border-[#85b7aa]" : "border-[#e4e8e3]"}`} key={job.id} onClick={() => setSelected(job)}>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1c2926] font-bold text-white">{job.company[0]}</div>
                  <div className="flex-1">
                    <p className="text-[12px] font-bold text-[#71807c]">{job.company}</p>
                    <p className="text-[14px] font-bold">{job.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-[#91a09c]"><MapPin size={11} />{job.location}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#176b5b]">ATS {job.ats_score}% / Match {job.match_score}% / {job.source}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-[#71807c]">{job.recommendation_summary}</p>
                  </div>
                  <MatchRing score={job.ats_score} small />
                </div>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="h-fit rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
              <p className="text-[12px] font-bold text-[#71807c]">{selected.company}</p>
              <h2 className="mt-1 text-[20px] font-bold">{selected.title}</h2>
              <p className="mt-2 text-[12px] text-[#91a09c]">{selected.location} / {selected.work_mode}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <ScoreTile label="Match score" value={`${selected.match_score}%`} />
                <ScoreTile label="ATS score" value={`${selected.ats_score}%`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{selected.matching_skills.map((skill) => <Pill tone="green" key={skill}><Check size={11} />{skill}</Pill>)}</div>
              {selected.missing_skills.length ? (
                <div className="mt-4 rounded-xl border border-[#f0e5d8] bg-[#fffaf2] p-4">
                  <p className="text-[12px] font-bold text-[#8a5a21]">Missing or unverified skills</p>
                  <div className="mt-2 flex flex-wrap gap-2">{selected.missing_skills.map((skill) => <Pill key={skill}>{skill}</Pill>)}</div>
                  <p className="mt-2 text-[11px] leading-5 text-[#8a7356]">Apply Wise will not add these unless they already exist in your uploaded resume/profile evidence.</p>
                </div>
              ) : null}
              <div className="mt-4 rounded-xl bg-[#e8f4ef] p-4">
                <p className="text-[12px] font-bold text-[#176b5b]">Why this role is recommended</p>
                <div className="mt-2 space-y-1">{selected.recommendation_reasons.map((reason) => <p className="text-[11px] leading-5 text-[#53645f]" key={reason}>- {reason}</p>)}</div>
              </div>
              <div className="mt-4 rounded-xl bg-[#f6f8f5] p-4">
                <p className="text-[12px] font-bold">ATS readiness {selected.ats_score}%</p>
                <div className="mt-2 grid gap-1 text-[11px] text-[#71807c]">{Object.entries(selected.ats_breakdown).map(([label, score]) => <p className="capitalize" key={label}>{label.replace("_", " ")}: {score}%</p>)}</div>
                {selected.ats_recommendations.map((item) => <p className="mt-2 text-[11px] text-[#71807c]" key={item}>{item}</p>)}
              </div>
              <div className="mt-4 rounded-xl border border-[#e4e8e3] bg-[#fbfcfa] p-4">
                <div className="flex items-center gap-2 text-[#176b5b]"><WandSparkles size={15} /><p className="text-[12px] font-bold">Prepare application materials</p></div>
                <p className="mt-2 text-[11px] leading-5 text-[#71807c]">Generate drafts grounded only in your uploaded resume. Missing skills stay as analysis, not invented claims.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60" disabled={preparing !== null} onClick={() => void generateResume()}>
                    {preparing === "resume" ? <LoaderCircle className="animate-spin" size={13} /> : <FileText size={13} />}Generate Tailored Resume
                  </button>
                  <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-60" disabled={preparing !== null} onClick={() => void generateCoverLetter()}>
                    {preparing === "cover" ? <LoaderCircle className="animate-spin" size={13} /> : <Mail size={13} />}Generate Cover Letter
                  </button>
                </div>
                {generationStatus ? <p className="mt-3 rounded-lg bg-[#e8f4ef] p-2 text-[11px] font-bold text-[#176b5b]">{generationStatus}</p> : null}
                {generatedResume ? (
                  <GeneratedPreview
                    actions={(
                      <>
                        <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => void copyText(formatResumePreview(generatedResume.resume_content), "Tailored resume")}><Copy size={12} />Copy</button>
                        <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => void downloadGeneratedResume("docx")}><Download size={12} />DOCX</button>
                        <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => void downloadGeneratedResume("pdf")}><Download size={12} />PDF</button>
                      </>
                    )}
                    title="Tailored resume preview"
                    value={formatResumePreview(generatedResume.resume_content)}
                    warnings={generatedResume.quality_warnings}
                  />
                ) : null}
                {generatedResume?.missing_skills_analysis?.length ? (
                  <div className="mt-3 rounded-lg bg-white p-3">
                    <p className="text-[11px] font-bold text-[#8a5a21]">Missing skills analysis</p>
                    <div className="mt-2 flex flex-wrap gap-2">{generatedResume.missing_skills_analysis.map((skill) => <Pill key={skill}>{skill}</Pill>)}</div>
                  </div>
                ) : null}
                {generatedResume?.ats_improvement_suggestions?.length ? (
                  <div className="mt-3 rounded-lg bg-white p-3">
                    <p className="text-[11px] font-bold text-[#176b5b]">ATS improvement suggestions</p>
                    {generatedResume.ats_improvement_suggestions.map((item) => <p className="mt-1 text-[11px] leading-5 text-[#71807c]" key={item}>- {item}</p>)}
                  </div>
                ) : null}
                {generatedCoverLetter ? (
                  <GeneratedPreview
                    actions={(
                      <>
                        <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => void copyText(generatedCoverLetter.content, "Cover letter")}><Copy size={12} />Copy</button>
                        <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => void downloadGeneratedCoverLetter()}><Download size={12} />TXT</button>
                      </>
                    )}
                    title="Cover letter preview"
                    value={generatedCoverLetter.content}
                    warnings={generatedCoverLetter.quality_warnings}
                  />
                ) : null}
              </div>
              <p className="mt-5 text-[13px] leading-6 text-[#65736f]">{selected.description}</p>
              <button className="mt-5 flex items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white disabled:opacity-60" disabled={selected.saved} onClick={() => void persistSavedJob(selected.id)}><Bookmark size={15} />{selected.saved ? "Saved to tracker" : "Save job"}</button>
              {selected.saved ? <Link className="mt-3 inline-flex rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b]" href={selected.application_id ? `/applications?application=${selected.application_id}` : "/applications"}>Open workflow</Link> : null}
              {selected.high_fit && selected.approval_status === "review_required" ? (
                <div className="mt-3 flex gap-2">
                  <button className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b]" onClick={() => void decide(selected.id, "approved")}>Approve 80+ role</button>
                  <button className="rounded-lg bg-[#fff4ef] px-3 py-2 text-[12px] font-bold text-[#a34f3f]" onClick={() => void decide(selected.id, "dismissed")}>Dismiss</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-[#e4e8e3] bg-white p-8 text-center small-shadow">
          <Search className="mx-auto text-[#91a09c]" />
          <h2 className="mt-4 text-[17px] font-bold">{hasResume ? "No jobs captured or matched yet" : "Upload your resume first"}</h2>
          <p className="mx-auto mt-2 max-w-xl text-[13px] text-[#71807c]">
            {hasResume
              ? searchAttempted
                ? "Try a broader role keyword, remove the location filter, paste a job description, or capture a job with the browser extension."
                : "Your resume is ready. Search by role, paste a job, or use the browser extension to capture LinkedIn and employer-site roles."
              : "Recommendations, ATS scores, and generated drafts need your persisted resume evidence. Upload your master resume before searching or capturing jobs."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link className="inline-flex items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white" href={hasResume ? "/jobs" : "/resume"}><FileText size={15} />{hasResume ? "Search again" : "Add resume"}</Link>
            {hasResume ? <button className="inline-flex items-center gap-2 rounded-xl border border-[#dce7e2] px-4 py-3 text-[12px] font-bold text-[#176b5b]" onClick={() => setShowCapture(true)}><Plus size={15} />Paste a job</button> : null}
          </div>
        </section>
      )}
      {jobs.some((job) => job.source === "adzuna" || job.source === "remotive") ? <p className="mt-5 text-[11px] font-bold text-[#91a09c]">Listings may be provided by <a className="text-[#176b5b] underline" href="https://www.adzuna.in/" rel="noreferrer" target="_blank">Adzuna</a> and <a className="text-[#176b5b] underline" href="https://remotive.com/remote-jobs" rel="noreferrer" target="_blank">Remotive</a>. Manually captured career-page roles are labeled separately.</p> : null}
    </AppShell>
  );
}

function ScoreTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f8f5] p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">{label}</p>
      <p className="mt-1 text-[20px] font-black text-[#176b5b]">{value}</p>
    </div>
  );
}

function GeneratedPreview({ actions, title, value, warnings }: { actions: ReactNode; title: string; value: string; warnings?: string[] }) {
  return (
    <div className="mt-4 rounded-xl border border-[#e4e8e3] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-bold text-[#23312e]">{title}</p>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {warnings?.length ? (
        <div className="mt-3 rounded-lg bg-[#fff4ef] p-3">
          <p className="text-[11px] font-bold text-[#a34f3f]">Review warnings</p>
          {warnings.map((warning) => <p className="mt-1 text-[11px] leading-5 text-[#a34f3f]" key={warning}>- {warning}</p>)}
        </div>
      ) : null}
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f6f8f5] p-3 text-[11px] leading-5 text-[#53645f]">{value}</pre>
    </div>
  );
}

function formatResumePreview(content: ResumeVersionDetail["resume_content"]) {
  const lines: string[] = [];
  if (content.professional_summary) lines.push(`Summary\n${content.professional_summary}`);
  if (Array.isArray(content.skills) && content.skills.length) lines.push(`Skills\n${content.skills.join(", ")}`);
  const bullets = Array.isArray(content.tailored_bullets) ? content.tailored_bullets.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  if (bullets.length) lines.push(`Tailored bullets\n${bullets.map((bullet) => `- ${bullet}`).join("\n")}`);
  if (Array.isArray(content.experience) && content.experience.length) {
    lines.push(`Experience\n${content.experience.map((item) => `${item.title} at ${item.company}\n${item.description}`).join("\n\n")}`);
  }
  return lines.join("\n\n") || "Generated resume draft is ready.";
}
