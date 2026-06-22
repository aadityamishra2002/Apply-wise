"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileText, LoaderCircle, Save, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ResumeFormatGuidance } from "@/components/resume-format-guidance";
import {
  APPLIED_CONFIRMATION_TEXT,
  applicationStatusSuccessMessage,
  buildApplicationStatusPayload,
  resolveStatusUpdateDecision,
} from "@/lib/application-status";
import {
  confirmReviewBeforeApply,
  downloadCoverLetter,
  downloadResumeVersion,
  getAccessToken,
  loadCoverLetter,
  loadReviewBeforeApply,
  loadResumeVersion,
  prepareApplication,
  saveCoverLetter,
  saveResumeVersion,
  updateApplication,
  type CoverLetterRecord,
  type ResumeContentDraft,
  type ResumeVersionDetail,
  type ReviewBeforeApply,
} from "@/lib/api";

export default function PrepareApplicationPage() {
  const params = useParams<{ id: string }>();
  const applicationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [review, setReview] = useState<ReviewBeforeApply | null>(null);
  const [resumeVersion, setResumeVersion] = useState<ResumeVersionDetail | null>(null);
  const [resumeDraft, setResumeDraft] = useState<ResumeContentDraft | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetterRecord | null>(null);
  const [coverLetterDraft, setCoverLetterDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void reloadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function reloadWorkspace() {
    const token = getAccessToken();
    if (!token || !applicationId) return;
    setLoading(true);
    setError(null);
    try {
      const loadedReview = await loadReviewBeforeApply(applicationId, token);
      setReview(loadedReview);
      if (loadedReview.resume_version_id) {
        const loadedResume = await loadResumeVersion(loadedReview.resume_version_id, token);
        setResumeVersion(loadedResume);
        setResumeDraft(loadedResume.resume_content);
      } else {
        setResumeVersion(null);
        setResumeDraft(null);
      }
      if (loadedReview.cover_letter_id) {
        const loadedCoverLetter = await loadCoverLetter(loadedReview.cover_letter_id, token);
        setCoverLetter(loadedCoverLetter);
        setCoverLetterDraft(loadedCoverLetter.content);
      } else {
        setCoverLetter(null);
        setCoverLetterDraft("");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this application.");
    } finally {
      setLoading(false);
    }
  }

  async function generateMaterials() {
    const token = getAccessToken();
    if (!token || !applicationId) return;
    setWorking("prepare");
    setError(null);
    setMessage(null);
    try {
      const prepared = await prepareApplication(applicationId, token);
      setMessage(`Prepared resume and cover letter using ${prepared.template_name}.`);
      await reloadWorkspace();
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Could not prepare application materials.");
    } finally {
      setWorking(null);
    }
  }

  async function confirmReview() {
    const token = getAccessToken();
    if (!token || !applicationId) return;
    setWorking("review");
    setError(null);
    try {
      const confirmed = await confirmReviewBeforeApply(applicationId, token);
      setReview(confirmed);
      setMessage("Review confirmed. Extension-assisted actions remain preview-and-approve only.");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Could not confirm this review.");
    } finally {
      setWorking(null);
    }
  }

  async function saveResumeDraft() {
    const token = getAccessToken();
    if (!token || !resumeVersion || !resumeDraft) return;
    setWorking("resume");
    setError(null);
    try {
      const saved = await saveResumeVersion(resumeVersion.id, resumeDraft, token);
      setResumeVersion(saved);
      setResumeDraft(saved.resume_content);
      setMessage("Tailored resume edits saved.");
      await reloadWorkspace();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save resume edits.");
    } finally {
      setWorking(null);
    }
  }

  async function saveCoverLetterDraft() {
    const token = getAccessToken();
    if (!token || !coverLetter) return;
    setWorking("cover");
    setError(null);
    try {
      const saved = await saveCoverLetter(coverLetter.id, coverLetterDraft, token);
      setCoverLetter(saved);
      setCoverLetterDraft(saved.content);
      setMessage("Cover letter edits saved.");
      await reloadWorkspace();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save cover letter edits.");
    } finally {
      setWorking(null);
    }
  }

  async function downloadResume(format: "docx" | "pdf") {
    const token = getAccessToken();
    if (!token || !resumeVersion) return;
    const warnings = resumeVersion.quality_warnings ?? [];
    const acknowledged = warnings.length
      ? window.confirm(`This resume has review warnings:\n\n${warnings.join("\n")}\n\nDownload anyway after reviewing?`)
      : false;
    if (warnings.length && !acknowledged) return;
    await downloadResumeVersion(resumeVersion.id, format, token, acknowledged);
  }

  async function downloadLetter() {
    const token = getAccessToken();
    if (token && coverLetter) await downloadCoverLetter(coverLetter.id, token);
  }

  async function changeStatus(status: "saved" | "preparing" | "applied") {
    const token = getAccessToken();
    if (!token || !applicationId) return;
    const decision = resolveStatusUpdateDecision(status, false, () => window.confirm(APPLIED_CONFIRMATION_TEXT));
    if (!decision.proceed) {
      setMessage("Application status unchanged.");
      return;
    }
    setWorking(status);
    setError(null);
    try {
      await updateApplication(applicationId, buildApplicationStatusPayload(status, decision.manualSubmissionConfirmed), token);
      setMessage(applicationStatusSuccessMessage(status));
      await reloadWorkspace();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update application status.");
    } finally {
      setWorking(null);
    }
  }

  function updateResumeDraft(next: Partial<ResumeContentDraft>) {
    setResumeDraft((current) => current ? { ...current, ...next } : current);
  }

  function updateResumeSkills(value: string) {
    updateResumeDraft({ skills: value.split(",").map((skill) => skill.trim()).filter(Boolean) });
  }

  function updateResumeExperience(index: number, field: "title" | "company" | "description", value: string) {
    setResumeDraft((current) => {
      if (!current) return current;
      const experience = current.experience.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item);
      return { ...current, experience };
    });
  }

  return (
    <AppShell
      actions={<Link className="rounded-lg border border-[#dfe6e2] bg-white px-3 py-2 text-[12px] font-bold text-[#65736f]" href="/applications">Back to board</Link>}
      eyebrow="Assisted Apply"
      title="Prepare application"
    >
      {loading ? (
        <div className="grid min-h-[360px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" /></div>
      ) : review ? (
        <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold text-[#71807c]">{review.company} / {review.location || "Location not provided"}</p>
                  <h2 className="mt-1 text-[22px] font-bold tracking-[-0.04em]">{review.job_title}</h2>
                  <p className="mt-2 text-[12px] font-bold capitalize text-[#176b5b]">Status: {review.application_status}</p>
                </div>
                <a className="inline-flex items-center gap-1 rounded-lg bg-[#1c2926] px-3 py-2 text-[12px] font-bold text-white" href={review.target_url} rel="noreferrer" target="_blank"><ExternalLink size={13} />Employer page</a>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ScoreTile label="Match score" value={review.match_score === null ? "--" : `${Math.round(review.match_score)}%`} />
                <ScoreTile label="ATS score" value={review.ats_score === null ? "--" : `${Math.round(review.ats_score)}%`} />
                <ScoreTile label="Template" value={review.template_name} />
              </div>
              <div className="mt-4">
                <ResumeFormatGuidance compact />
              </div>
              <div className="mt-4 rounded-xl bg-[#fff4ef] p-4">
                <div className="flex items-center gap-2 text-[#a34f3f]"><AlertTriangle size={15} /><p className="text-[12px] font-bold">Manual final submission required</p></div>
                <p className="mt-2 text-[12px] leading-5 text-[#8a5a21]">Apply Wise prepares and tracks materials. You must review every employer-site field and click the final submit button yourself.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
              <h3 className="text-[15px] font-bold">Fit review</h3>
              <SkillList title="Matching skills" skills={review.matching_skills} tone="green" />
              <SkillList title="Missing or unverified skills" skills={review.missing_skills} tone="orange" />
              <p className="mt-3 text-[11px] leading-5 text-[#71807c]">Missing skills are analysis only. Apply Wise will not fabricate skills, employers, projects, dates, or metrics.</p>
            </div>

            <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
              <h3 className="text-[15px] font-bold">Review checklist</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Step ready={review.resume_prepared} label="Tailored resume ready" />
                <Step ready={review.cover_letter_prepared} label="Cover letter ready" />
                <Step ready={review.review_confirmed} label="Manual review confirmed" />
                <Step ready={review.manual_final_submission_required} label="Final submit stays manual" />
              </div>
              {review.missing_fields.length ? <div className="mt-4 rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{review.missing_fields.join(", ")} need attention.</div> : null}
              {review.warnings.map((warning) => <p className="mt-2 text-[11px] font-bold text-[#a34f3f]" key={warning}>{warning}</p>)}
              <button className="mt-4 inline-flex items-center gap-1 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60" disabled={review.review_confirmed || working === "review"} onClick={() => void confirmReview()}>{working === "review" ? <LoaderCircle className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}I reviewed this application</button>
            </div>
          </section>

          <section className="space-y-5">
            {error ? <p className="rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{error}</p> : null}
            {message ? <p className="rounded-xl bg-[#e8f4ef] p-3 text-[12px] font-bold text-[#176b5b]">{message}</p> : null}

            <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-bold">Application materials</h3>
                  <p className="mt-1 text-[12px] text-[#71807c]">Generate grounded drafts, review/edit, then download for manual use.</p>
                </div>
                <button className="inline-flex items-center gap-1 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60" disabled={working === "prepare"} onClick={() => void generateMaterials()}>{working === "prepare" ? <LoaderCircle className="animate-spin" size={13} /> : <WandSparkles size={13} />}{resumeVersion && coverLetter ? "Regenerate materials" : "Generate materials"}</button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-60" disabled={!resumeVersion} onClick={() => void downloadResume("docx")}><Download className="inline" size={13} /> Resume DOCX</button>
                <button className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-60" disabled={!resumeVersion} onClick={() => void downloadResume("pdf")}><Download className="inline" size={13} /> Resume PDF</button>
                <button className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-60" disabled={!coverLetter} onClick={() => void downloadLetter()}><Download className="inline" size={13} /> Cover letter</button>
              </div>
            </div>

            {resumeDraft ? (
              <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#176b5b]"><FileText size={16} /><h3 className="text-[15px] font-bold">Tailored resume</h3></div>
                  <button className="inline-flex items-center gap-1 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60" disabled={working === "resume" || !resumeDraft.experience.length || !resumeDraft.skills.length} onClick={() => void saveResumeDraft()}>{working === "resume" ? <LoaderCircle className="animate-spin" size={13} /> : <Save size={13} />}Save resume edits</button>
                </div>
                {resumeVersion?.quality_warnings.length ? <WarningList warnings={resumeVersion.quality_warnings} /> : null}
                <label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Summary</label>
                <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#dce7e2] bg-[#fbfcfa] p-3 text-[12px] leading-6 outline-none focus:border-[#79b6a8]" onChange={(event) => updateResumeDraft({ professional_summary: event.target.value })} value={resumeDraft.professional_summary ?? ""} />
                <label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Skills</label>
                <textarea className="mt-2 min-h-20 w-full rounded-xl border border-[#dce7e2] bg-[#fbfcfa] p-3 text-[12px] leading-6 outline-none focus:border-[#79b6a8]" onChange={(event) => updateResumeSkills(event.target.value)} value={resumeDraft.skills.join(", ")} />
                <div className="mt-4 space-y-3">
                  {resumeDraft.experience.map((item, index) => (
                    <div className="rounded-xl bg-[#f6f8f5] p-3" key={`${item.company}-${item.title}-${index}`}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => updateResumeExperience(index, "title", event.target.value)} value={item.title} />
                        <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => updateResumeExperience(index, "company", event.target.value)} value={item.company} />
                      </div>
                      <textarea className="mt-2 min-h-24 w-full rounded-lg border border-[#dce7e2] p-3 text-[12px] leading-6" onChange={(event) => updateResumeExperience(index, "description", event.target.value)} value={item.description} />
                    </div>
                  ))}
                </div>
                <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f6f8f5] p-3 text-[11px] leading-5 text-[#53645f]">{formatResumePreview(resumeDraft)}</pre>
              </div>
            ) : null}

            {coverLetter ? (
              <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[15px] font-bold">Cover letter</h3>
                  <button className="inline-flex items-center gap-1 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60" disabled={working === "cover" || coverLetterDraft.trim().length < 20} onClick={() => void saveCoverLetterDraft()}>{working === "cover" ? <LoaderCircle className="animate-spin" size={13} /> : <Save size={13} />}Save letter edits</button>
                </div>
                {coverLetter.quality_warnings.length ? <WarningList warnings={coverLetter.quality_warnings} /> : null}
                <textarea className="mt-4 min-h-80 w-full rounded-xl border border-[#dce7e2] bg-[#fbfcfa] p-4 text-[12px] leading-6 outline-none focus:border-[#79b6a8]" onChange={(event) => setCoverLetterDraft(event.target.value)} value={coverLetterDraft} />
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
              <h3 className="text-[15px] font-bold">Application status</h3>
              <p className="mt-1 text-[12px] text-[#71807c]">Use Applied only after you manually submit on the employer site.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-lg bg-[#f6f8f5] px-3 py-2 text-[12px] font-bold text-[#176b5b]" onClick={() => void changeStatus("saved")}>Mark Saved</button>
                <button className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b]" onClick={() => void changeStatus("preparing")}>Mark Preparing</button>
                <button className="rounded-lg bg-[#fff4ef] px-3 py-2 text-[12px] font-bold text-[#a34f3f]" onClick={() => void changeStatus("applied")}>Mark Applied</button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-[#d5dedb] bg-white p-8 text-center">
          <h2 className="text-[16px] font-bold">Application not found</h2>
          <Link className="mt-4 inline-flex rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white" href="/applications">Back to applications</Link>
        </section>
      )}
    </AppShell>
  );
}

function ScoreTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f8f5] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#91a09c]">{label}</p>
      <p className="mt-1 break-words text-[18px] font-black text-[#176b5b]">{value}</p>
    </div>
  );
}

function SkillList({ skills, title, tone }: { skills: string[]; title: string; tone: "green" | "orange" }) {
  return (
    <div className="mt-4">
      <p className={`text-[12px] font-bold ${tone === "green" ? "text-[#176b5b]" : "text-[#8a5a21]"}`}>{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {skills.length ? skills.map((skill) => <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${tone === "green" ? "bg-[#e8f4ef] text-[#176b5b]" : "bg-[#fffaf2] text-[#8a5a21]"}`} key={skill}>{skill}</span>) : <span className="text-[12px] text-[#91a09c]">None detected.</span>}
      </div>
    </div>
  );
}

function Step({ label, ready }: { label: string; ready: boolean }) {
  return <p className={`rounded-xl p-3 text-[12px] font-bold ${ready ? "bg-[#e8f4ef] text-[#176b5b]" : "bg-[#fff4ef] text-[#a34f3f]"}`}>{ready ? "Ready" : "Pending"}: {label}</p>;
}

function WarningList({ warnings }: { warnings: string[] }) {
  return (
    <div className="mt-4 rounded-xl bg-[#fff4ef] p-3">
      <p className="text-[11px] font-bold text-[#a34f3f]">Review warnings</p>
      {warnings.map((warning) => <p className="mt-1 text-[11px] leading-5 text-[#a34f3f]" key={warning}>- {warning}</p>)}
    </div>
  );
}

function formatResumePreview(content: ResumeContentDraft) {
  const lines: string[] = [];
  if (content.professional_summary) lines.push(`Summary\n${content.professional_summary}`);
  if (content.skills.length) lines.push(`Skills\n${content.skills.join(", ")}`);
  const bullets = Array.isArray(content.tailored_bullets) ? content.tailored_bullets.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  if (bullets.length) lines.push(`Tailored bullets\n${bullets.map((bullet) => `- ${bullet}`).join("\n")}`);
  if (content.experience.length) {
    lines.push(`Experience\n${content.experience.map((item) => `${item.title} at ${item.company}\n${item.description}`).join("\n\n")}`);
  }
  return lines.join("\n\n") || "No resume content yet.";
}
