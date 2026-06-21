"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Pencil,
  Save,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  APPLIED_CONFIRMATION_TEXT,
  applicationStatusSuccessMessage,
  buildApplicationStatusPayload,
  replaceApplicationRecord,
  resolveStatusUpdateDecision,
} from "@/lib/application-status";
import {
  confirmReviewBeforeApply,
  createAutomationRun,
  createPrepareRun,
  createInterview,
  deleteInterview,
  downloadCoverLetter,
  downloadResumeVersion,
  getAccessToken,
  loadApplicationEvents,
  loadApplicationAutomationPlan,
  loadApplications,
  loadAssistedApplicationChecklist,
  loadAutomationRuns,
  loadCoverLetter,
  loadInterviews,
  loadReviewBeforeApply,
  loadPrepareRuns,
  loadResumeVersion,
  prepareApplication,
  retryBackgroundJob,
  saveCoverLetter,
  saveResumeVersion,
  updateApplication,
  updateInterview,
  type ApplicationEvent,
  type ApplicationAutomationPlan,
  type ApplicationMaterials,
  type ApplicationRecord,
  type AssistedApplicationChecklist,
  type AutomationRun,
  type BackgroundJob,
  type CoverLetterRecord,
  type ResumeContentDraft,
  type ResumeVersionDetail,
  type InterviewRecord,
  type ReviewBeforeApply,
} from "@/lib/api";

const statuses = ["saved", "preparing", "applied", "interview", "rejected", "offer", "withdrawn"];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [materials, setMaterials] = useState<ApplicationMaterials | null>(null);
  const [selected, setSelected] = useState<ApplicationRecord | null>(null);
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [notes, setNotes] = useState("");
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [interviewRound, setInterviewRound] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [editingInterviewId, setEditingInterviewId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<AssistedApplicationChecklist | null>(null);
  const [automationPlan, setAutomationPlan] = useState<ApplicationAutomationPlan | null>(null);
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([]);
  const [prepareRuns, setPrepareRuns] = useState<BackgroundJob[]>([]);
  const [reviewBeforeApply, setReviewBeforeApply] = useState<ReviewBeforeApply | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetterRecord | null>(null);
  const [coverLetterDraft, setCoverLetterDraft] = useState("");
  const [coverLetterSaved, setCoverLetterSaved] = useState(false);
  const [resumeVersion, setResumeVersion] = useState<ResumeVersionDetail | null>(null);
  const [resumeDraft, setResumeDraft] = useState<ResumeContentDraft | null>(null);
  const [resumeSaved, setResumeSaved] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const requestedApplicationId = new URLSearchParams(window.location.search).get("application");
    void loadApplications(token)
      .then((items) => {
        setApplications(items);
        const preferred = items.find((item) => item.id === requestedApplicationId) ?? items[0];
        if (preferred) void inspect(preferred);
      })
      .finally(() => setLoading(false));
  }, []);

  async function inspect(application: ApplicationRecord) {
    const token = getAccessToken();
    if (!token) return;
    setSelected(application);
    setNotes(application.notes ?? "");
    const [loadedEvents, loadedInterviews, loadedChecklist] = await Promise.all([
      loadApplicationEvents(application.id, token),
      loadInterviews(application.id, token),
      loadAssistedApplicationChecklist(application.id, token),
    ]);
    const [loadedAutomationPlan, loadedAutomationRuns, loadedPrepareRuns] = await Promise.all([
      loadApplicationAutomationPlan(application.id, token).catch(() => null),
      loadAutomationRuns(application.id, token).catch(() => []),
      loadPrepareRuns(application.id, token).catch(() => []),
    ]);
    const loadedReviewBeforeApply = await loadReviewBeforeApply(application.id, token).catch(() => null);
    setEvents(loadedEvents);
    setInterviews(loadedInterviews);
    setChecklist(loadedChecklist);
    setAutomationPlan(loadedAutomationPlan);
    setAutomationRuns(loadedAutomationRuns);
    setPrepareRuns(loadedPrepareRuns);
    setReviewBeforeApply(loadedReviewBeforeApply);
    setCoverLetterSaved(false);
    setResumeSaved(false);
    if (loadedChecklist.resume_version_id) {
      const loadedResumeVersion = await loadResumeVersion(loadedChecklist.resume_version_id, token);
      setResumeVersion(loadedResumeVersion);
      setResumeDraft(loadedResumeVersion.resume_content);
    } else {
      setResumeVersion(null);
      setResumeDraft(null);
    }
    if (loadedChecklist.cover_letter_id) {
      const loadedCoverLetter = await loadCoverLetter(loadedChecklist.cover_letter_id, token);
      setCoverLetter(loadedCoverLetter);
      setCoverLetterDraft(loadedCoverLetter.content);
    } else {
      setCoverLetter(null);
      setCoverLetterDraft("");
    }
  }

  async function scheduleInterview() {
    const token = getAccessToken();
    if (!token || !selected || !interviewRound || !scheduledAt) return;
    setUpdating(selected.id);
    try {
      const payload = {
        interview_round: interviewRound,
        scheduled_at: new Date(scheduledAt).toISOString(),
        notes: interviewNotes || null,
      };
      if (editingInterviewId) await updateInterview(selected.id, editingInterviewId, payload, token);
      else await createInterview(selected.id, payload, token);
      setInterviewRound("");
      setScheduledAt("");
      setInterviewNotes("");
      setEditingInterviewId(null);
      const updated = { ...selected, status: "interview" };
      setApplications((current) => current.map((item) => (item.id === selected.id ? updated : item)));
      void inspect(updated);
    } finally {
      setUpdating(null);
    }
  }

  function editInterview(interview: InterviewRecord) {
    setEditingInterviewId(interview.id);
    setInterviewRound(interview.interview_round);
    setScheduledAt(new Date(interview.scheduled_at).toISOString().slice(0, 16));
    setInterviewNotes(interview.notes ?? "");
  }

  async function removeInterview(interviewId: string) {
    const token = getAccessToken();
    if (!token || !selected) return;
    await deleteInterview(selected.id, interviewId, token);
    if (editingInterviewId === interviewId) {
      setEditingInterviewId(null);
      setInterviewRound("");
      setScheduledAt("");
      setInterviewNotes("");
    }
    void inspect(selected);
  }

  async function changeStatus(applicationId: string, status: string, confirmedManualSubmit = false) {
    const token = getAccessToken();
    if (!token) {
      setStatusError("Your session expired. Log in again to update this application.");
      return;
    }
    const decision = resolveStatusUpdateDecision(status, confirmedManualSubmit, confirmAppliedStatus);
    if (!decision.proceed) {
      setStatusMessage("Application status unchanged.");
      setStatusError(null);
      return;
    }
    setUpdating(applicationId);
    setStatusMessage(null);
    setStatusError(null);
    try {
      const updated = await updateApplication(applicationId, buildApplicationStatusPayload(status, decision.manualSubmissionConfirmed), token);
      setApplications((current) => replaceApplicationRecord(current, updated));
      setStatusMessage(applicationStatusSuccessMessage(updated.status));
      if (selected?.id === updated.id) {
        setSelected(updated);
        void inspect(updated);
      }
    } catch (updateError) {
      setStatusError(updateError instanceof Error ? updateError.message : "Could not update this application.");
    } finally {
      setUpdating(null);
    }
  }

  async function saveNotes() {
    const token = getAccessToken();
    if (!token || !selected) return;
    setUpdating(selected.id);
    try {
      const updated = await updateApplication(selected.id, { notes }, token);
      setApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      void inspect(updated);
    } finally {
      setUpdating(null);
    }
  }

  async function prepare(applicationId: string) {
    const token = getAccessToken();
    if (!token) return;
    setUpdating(applicationId);
    try {
      const prepared = await prepareApplication(applicationId, token);
      setMaterials(prepared);
      const preparedResume = await loadResumeVersion(prepared.resume_version_id, token);
      const preparedCoverLetter = await loadCoverLetter(prepared.cover_letter_id, token);
      setResumeVersion(preparedResume);
      setResumeDraft(preparedResume.resume_content);
      setResumeSaved(false);
      setCoverLetter(preparedCoverLetter);
      setCoverLetterDraft(preparedCoverLetter.content);
      setCoverLetterSaved(false);
      setApplications((current) => current.map((item) => (item.id === prepared.application.id ? prepared.application : item)));
      await inspect(prepared.application);
    } finally {
      setUpdating(null);
    }
  }

  async function markApplied() {
    if (!selected) return;
    if (!confirmAppliedStatus()) return;
    await changeStatus(selected.id, "applied", true);
  }

  async function queuePrepareRun() {
    const token = getAccessToken();
    if (!token || !selected) return;
    setUpdating(selected.id);
    try {
      const run = await createPrepareRun(selected.id, token);
      const refreshedRuns = await loadPrepareRuns(selected.id, token).catch(() => [run]);
      setPrepareRuns(refreshedRuns);
      const refreshedEvents = await loadApplicationEvents(selected.id, token);
      setEvents(refreshedEvents);
      await inspect(selected);
    } finally {
      setUpdating(null);
    }
  }

  async function retryPrepareRun(jobId: string) {
    const token = getAccessToken();
    if (!token || !selected) return;
    setUpdating(selected.id);
    try {
      await retryBackgroundJob(jobId, token);
      const refreshedRuns = await loadPrepareRuns(selected.id, token);
      setPrepareRuns(refreshedRuns);
      const refreshedEvents = await loadApplicationEvents(selected.id, token);
      setEvents(refreshedEvents);
      await inspect(selected);
    } finally {
      setUpdating(null);
    }
  }

  async function confirmApplicationReview() {
    const token = getAccessToken();
    if (!token || !selected) return;
    setUpdating(selected.id);
    try {
      const confirmed = await confirmReviewBeforeApply(selected.id, token);
      setReviewBeforeApply(confirmed);
      const refreshedEvents = await loadApplicationEvents(selected.id, token);
      setEvents(refreshedEvents);
    } finally {
      setUpdating(null);
    }
  }

  async function startAutomationRun() {
    const token = getAccessToken();
    if (!token || !selected) return;
    setUpdating(selected.id);
    try {
      const run = await createAutomationRun(selected.id, token);
      setAutomationRuns((current) => [run, ...current].slice(0, 10));
      const refreshedEvents = await loadApplicationEvents(selected.id, token);
      setEvents(refreshedEvents);
    } finally {
      setUpdating(null);
    }
  }

  function downloadPrepared(format: "docx" | "pdf") {
    const token = getAccessToken();
    const versionId = materials?.resume_version_id ?? checklist?.resume_version_id;
    if (!token || !versionId) return;
    const warnings = reviewBeforeApply?.quality_warnings ?? [];
    const acknowledged = warnings.length
      ? window.confirm(`This resume has unsupported-claim warnings:\n\n${warnings.join("\n")}\n\nDownload anyway after reviewing?`)
      : false;
    if (warnings.length && !acknowledged) return;
    void downloadResumeVersion(versionId, format, token, acknowledged);
  }

  function downloadPreparedCoverLetter() {
    const token = getAccessToken();
    const coverLetterId = materials?.cover_letter_id ?? checklist?.cover_letter_id;
    if (token && coverLetterId) void downloadCoverLetter(coverLetterId, token);
  }

  async function saveCoverLetterDraft() {
    const token = getAccessToken();
    const coverLetterId = coverLetter?.id ?? materials?.cover_letter_id ?? checklist?.cover_letter_id;
    if (!token || !coverLetterId) return;
    const saved = await saveCoverLetter(coverLetterId, coverLetterDraft, token);
    setCoverLetter(saved);
    setCoverLetterDraft(saved.content);
    setCoverLetterSaved(true);
  }

  async function saveResumeDraft() {
    const token = getAccessToken();
    const versionId = resumeVersion?.id ?? materials?.resume_version_id ?? checklist?.resume_version_id;
    if (!token || !versionId || !resumeDraft) return;
    const saved = await saveResumeVersion(versionId, resumeDraft, token);
    setResumeVersion(saved);
    setResumeDraft(saved.resume_content);
    setResumeSaved(true);
  }

  function updateResumeDraft(next: Partial<ResumeContentDraft>) {
    setResumeDraft((current) => current ? { ...current, ...next } : current);
    setResumeSaved(false);
  }

  function updateResumeExperience(index: number, field: "title" | "company" | "description", value: string) {
    setResumeDraft((current) => {
      if (!current) return current;
      const experience = current.experience.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item);
      return { ...current, experience };
    });
    setResumeSaved(false);
  }

  function updateResumeSkills(value: string) {
    updateResumeDraft({ skills: value.split(",").map((skill) => skill.trim()).filter(Boolean) });
  }

  const preparedVersionId = materials?.resume_version_id ?? checklist?.resume_version_id;
  const preparedCoverLetterId = materials?.cover_letter_id ?? checklist?.cover_letter_id;
  const selectedIsApplied = selected?.status === "applied" || selected?.status === "interview" || selected?.status === "offer";
  const archivedStatuses = new Set(["rejected", "withdrawn"]);
  const visibleApplications = applications.filter((application) => showArchived ? archivedStatuses.has(application.status) : !archivedStatuses.has(application.status));
  const archivedCount = applications.filter((application) => archivedStatuses.has(application.status)).length;

  return (
    <AppShell eyebrow="Application tracker" title="Your pipeline">
      {statusError ? <p className="mb-4 rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{statusError}</p> : null}
      {statusMessage ? <p className="mb-4 rounded-xl bg-[#e8f4ef] p-3 text-[12px] font-bold text-[#176b5b]">{statusMessage}</p> : null}
      {loading ? (
        <div className="grid min-h-[300px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" /></div>
      ) : applications.length ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
          <section className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold">{showArchived ? "Archived opportunities" : "Saved opportunities"}</h2>
                <p className="mt-1 text-[12px] text-[#71807c]">{showArchived ? "Rejected and withdrawn roles are kept here for history and learning." : "Active roles you are still reviewing, preparing, or interviewing for."}</p>
              </div>
              <button className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b]" onClick={() => setShowArchived((current) => !current)}>{showArchived ? "Show active" : `Show archived (${archivedCount})`}</button>
            </div>
            <div className="mt-4 space-y-3">
              {visibleApplications.length ? visibleApplications.map((application) => (
                <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${selected?.id === application.id ? "border-[#85b7aa]" : "border-[#edf0ed]"}`} key={application.id} onClick={() => void inspect(application)}>
                  <div>
                    <p className="text-[13px] font-bold">{application.title}</p>
                    <p className="mt-1 text-[12px] text-[#71807c]">{application.company}</p>
                    {application.applied_at ? <p className="mt-1 text-[11px] font-bold text-[#176b5b]">Applied {new Date(application.applied_at).toLocaleDateString()}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={updating === application.id} onClick={(event) => { event.stopPropagation(); void prepare(application.id); }}>
                      <WandSparkles size={13} />Prepare
                    </button>
                    <select aria-label={`Status for ${application.title}`} className="rounded-lg border border-[#dce7e2] bg-[#fbfcfa] px-3 py-2 text-[12px] font-bold capitalize text-[#176b5b]" disabled={updating === application.id} onChange={(event) => void changeStatus(application.id, event.target.value)} onClick={(event) => event.stopPropagation()} value={application.status}>
                      {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                </div>
              )) : <p className="rounded-xl border border-dashed border-[#d5dedb] p-5 text-center text-[12px] text-[#91a09c]">{showArchived ? "No archived roles yet." : "No active roles in this view."}</p>}
            </div>
          </section>

          {selected ? (
            <section className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
              <h2 className="text-[16px] font-bold">Application workspace</h2>
              <p className="mt-1 text-[12px] text-[#71807c]">{selected.title} / {selected.company}</p>
              {selected.applied_at ? <p className="mt-2 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]">Application date: {new Date(selected.applied_at).toLocaleDateString()}</p> : null}
              <textarea className="mt-4 min-h-28 w-full rounded-xl border border-[#dce7e2] p-3 text-[12px] outline-none focus:border-[#79b6a8]" onChange={(event) => setNotes(event.target.value)} placeholder="Add follow-up notes, recruiter context, or next steps." value={notes} />
              <button className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white" onClick={() => void saveNotes()}><Save size={13} />Save notes</button>
              <div className="mt-5 border-t border-[#edf0ed] pt-4">
                <div className="flex items-center gap-2"><Clock3 className="text-[#176b5b]" size={15} /><h3 className="text-[13px] font-bold">Activity timeline</h3></div>
                <div className="mt-3 space-y-2">
                  {events.length ? events.map((event) => (
                    <div className="rounded-lg bg-[#f6f8f5] p-3 text-[11px] text-[#65736f]" key={event.id}>
                      <p className="font-bold capitalize">{event.event_type.replace("_", " ")}</p>
                      <p className="mt-1">{event.from_status && event.to_status ? `${event.from_status} -> ${event.to_status}` : "Application note updated"}</p>
                      {eventSummary(event) ? <p className="mt-1 text-[#71807c]">{eventSummary(event)}</p> : null}
                    </div>
                  )) : <p className="text-[12px] text-[#91a09c]">No activity recorded yet.</p>}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-[#d5dedb] bg-white p-8 text-center">
          <BriefcaseBusiness className="mx-auto text-[#91a09c]" />
          <h2 className="mt-3 text-[16px] font-bold">No applications yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-[12px] leading-5 text-[#71807c]">Capture a job with the extension or save a scored role from Jobs. Apply Wise helps prepare and track the application, but you still submit manually on LinkedIn, Easy Apply, or the employer site.</p>
          <Link className="mt-4 inline-flex rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white" href="/jobs">Capture or save a job</Link>
        </section>
      )}

      {selected && checklist ? (
        <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold">Guided application workflow</h2>
              <p className="mt-1 text-[12px] text-[#71807c]">Prepare truthful materials, review the employer page, then mark the role applied after you submit manually.</p>
            </div>
            <p className="rounded-full bg-[#f6f8f5] px-3 py-1 text-[11px] font-bold text-[#176b5b]">{[checklist.ats_approved, checklist.resume_prepared, checklist.cover_letter_prepared, selectedIsApplied].filter(Boolean).length}/4 ready</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <WorkflowStep label="Approve 80+ ATS role" ready={checklist.ats_approved} detail="Approve high-fit roles from the Jobs page before preparing." />
            <WorkflowStep label="Prepare resume and cover letter" ready={checklist.resume_prepared && checklist.cover_letter_prepared} detail="Drafts use only your stored resume evidence." />
            <WorkflowStep label="Review employer page" ready={Boolean(checklist.target_url)} detail="Open the job page and review fields before submitting." />
            <WorkflowStep label="Mark applied after submission" ready={Boolean(selectedIsApplied)} detail="This stores your first applied date for analytics." />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50" disabled={updating === selected.id} onClick={() => void prepare(selected.id)}><WandSparkles size={13} />Prepare materials</button>
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={updating === selected.id} onClick={() => void queuePrepareRun()}><Clock3 size={13} />Queue prepare run</button>
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={!preparedVersionId} onClick={() => downloadPrepared("docx")}><Download size={13} />Resume DOCX</button>
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={!preparedVersionId} onClick={() => downloadPrepared("pdf")}><Download size={13} />Resume PDF</button>
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={!preparedCoverLetterId} onClick={() => downloadPreparedCoverLetter()}><Download size={13} />Cover letter TXT</button>
            <a className="inline-flex items-center gap-1 rounded-lg bg-[#1c2926] px-3 py-2 text-[12px] font-bold text-white" href={checklist.target_url} rel="noreferrer" target="_blank"><ExternalLink size={13} />Open employer page</a>
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#fff4ef] px-3 py-2 text-[12px] font-bold text-[#a34f3f] disabled:opacity-50" disabled={selectedIsApplied || updating === selected.id} onClick={() => void markApplied()}>{updating === selected.id ? <LoaderCircle className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}{updating === selected.id ? "Updating..." : "Mark applied"}</button>
          </div>
          <div className="mt-4 rounded-xl bg-[#f6f8f5] p-3">
            <h3 className="text-[12px] font-bold">Preparation run history</h3>
            <div className="mt-2 space-y-2">
              {prepareRuns.length ? prepareRuns.slice(0, 3).map((run) => (
                <div className="rounded-lg bg-white p-3" key={run.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold capitalize">{run.status.replaceAll("_", " ")}</p>
                    <span className="text-[10px] font-bold text-[#71807c]">{run.attempts} attempt{run.attempts === 1 ? "" : "s"}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#71807c]">{new Date(run.created_at).toLocaleString()}</p>
                  {typeof run.result.generation_status === "string" ? <p className="mt-1 text-[11px] font-bold text-[#176b5b]">{run.result.generation_status.replaceAll("_", " ")}</p> : null}
                  {run.error_message ? <p className="mt-1 text-[11px] font-bold text-[#a34f3f]">{run.error_message}</p> : null}
                  {run.status === "failed" ? <button className="mt-2 rounded-lg bg-[#fff4ef] px-3 py-2 text-[11px] font-bold text-[#a34f3f]" onClick={() => void retryPrepareRun(run.id)}>Retry run</button> : null}
                </div>
              )) : <p className="text-[11px] text-[#71807c]">No queued preparation runs yet.</p>}
            </div>
          </div>
          <p className="mt-3 text-[11px] font-bold text-[#a34f3f]">Manual final submission required. Review every employer field before submitting.</p>
        </section>
      ) : null}

      {selected && automationPlan ? (
        <>
        {reviewBeforeApply ? (
          <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold">Review application</h2>
                <p className="mt-1 text-[12px] text-[#71807c]">Confirm the role, scores, generated materials, application fields, and warnings before any assisted apply action.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${reviewBeforeApply.review_confirmed ? "bg-[#e8f4ef] text-[#176b5b]" : "bg-[#fff4ef] text-[#a34f3f]"}`}>{reviewBeforeApply.review_confirmed ? "Review confirmed" : "Review required"}</span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_.8fr]">
              <div className="rounded-xl bg-[#f6f8f5] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#91a09c]">Selected job</p>
                <h3 className="mt-2 text-[17px] font-bold">{reviewBeforeApply.job_title}</h3>
                <p className="mt-1 text-[12px] text-[#71807c]">{reviewBeforeApply.company} / {reviewBeforeApply.location} / {reviewBeforeApply.source}</p>
                <a className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#176b5b]" href={reviewBeforeApply.target_url} rel="noreferrer" target="_blank"><ExternalLink size={13} />Employer page</a>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ScoreCard label="Match score" value={reviewBeforeApply.match_score === null ? "--" : `${Math.round(reviewBeforeApply.match_score)}%`} />
                <ScoreCard label="ATS score" value={reviewBeforeApply.ats_score === null ? "--" : `${Math.round(reviewBeforeApply.ats_score)}%`} />
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <WorkflowStep label="Resume ready" ready={reviewBeforeApply.resume_prepared} detail="Download or attach the latest tailored resume." />
              <WorkflowStep label="Cover letter ready" ready={reviewBeforeApply.cover_letter_prepared} detail="Review tone and employer-specific details." />
              <WorkflowStep label="Manual submit" ready={reviewBeforeApply.manual_final_submission_required} detail="You must submit on the employer site yourself." />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[#edf0ed] p-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Tailored resume version</p>
                <p className="mt-2 text-[11px] font-bold text-[#176b5b]">{reviewBeforeApply.resume_version_id ?? "Not prepared"}</p>
                <p className="mt-2 line-clamp-6 text-[12px] leading-6 text-[#65736f]">{reviewBeforeApply.resume_summary ?? "Prepare a tailored resume before assisted application."}</p>
              </div>
              <div className="rounded-xl border border-[#edf0ed] p-4">
                <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Cover letter</p>
                <p className="mt-2 text-[11px] font-bold text-[#176b5b]">{reviewBeforeApply.cover_letter_id ?? "Not prepared"}</p>
                <p className="mt-2 line-clamp-6 whitespace-pre-line text-[12px] leading-6 text-[#65736f]">{reviewBeforeApply.cover_letter_preview ?? "Prepare a cover letter before assisted application."}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Required application fields</h3>
                <div className="mt-2 space-y-2">
                  {reviewBeforeApply.autofill_fields.slice(0, 10).map((field) => (
                    <div className="rounded-xl bg-[#f6f8f5] p-3" key={field.field_key}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12px] font-bold">{field.label}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${field.requires_review ? "bg-[#fff4ef] text-[#a34f3f]" : "bg-[#e8f4ef] text-[#176b5b]"}`}>{Math.round(field.confidence * 100)}%</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#71807c]">{field.value || "Manual value required"} / {field.source}{field.sensitive ? " / Sensitive" : ""}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Needs manual attention</h3>
                <div className="mt-2 space-y-2">
                  {reviewBeforeApply.missing_fields.length ? reviewBeforeApply.missing_fields.map((field) => <p className="rounded-xl bg-[#fff4ef] p-3 text-[11px] font-bold text-[#a34f3f]" key={field}>{field}</p>) : <p className="rounded-xl bg-[#e8f4ef] p-3 text-[11px] font-bold text-[#176b5b]">No missing review fields detected.</p>}
                </div>
                {reviewBeforeApply.quality_warnings.length ? <>
                  <h3 className="mt-4 text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Unsupported claim warnings</h3>
                  <div className="mt-2 space-y-2">
                    {reviewBeforeApply.quality_warnings.map((warning) => <p className="rounded-xl bg-[#fff4ef] p-3 text-[11px] font-bold text-[#a34f3f]" key={warning}>{warning}</p>)}
                  </div>
                </> : null}
                <div className="mt-3 space-y-1">
                  {reviewBeforeApply.warnings.map((warning) => <p className="text-[11px] font-bold text-[#a34f3f]" key={warning}>{warning}</p>)}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#edf0ed] pt-4">
              <button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50" disabled={reviewBeforeApply.review_confirmed || updating === selected.id} onClick={() => void confirmApplicationReview()}>I reviewed this application</button>
              <a className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-bold ${reviewBeforeApply.review_confirmed ? "bg-[#1c2926] text-white" : "bg-[#f6f8f5] text-[#91a09c]"}`} href={reviewBeforeApply.review_confirmed ? reviewBeforeApply.target_url : undefined} rel="noreferrer" target="_blank"><ExternalLink size={13} />Open employer page after review</a>
              <p className="text-[11px] font-bold text-[#a34f3f]">Final submit must be clicked manually on the employer site.</p>
            </div>
          </section>
        ) : null}
        <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold">Dry-run automation plan</h2>
              <p className="mt-1 text-[12px] text-[#71807c]">{automationPlan.capability.site_name} adapter. It can guide preparation, but final submission is manual.</p>
            </div>
            <span className="rounded-full bg-[#fff4ef] px-3 py-1 text-[11px] font-bold text-[#a34f3f]">Manual submit required</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <CapabilityPill label="Capture" ready={automationPlan.capability.capture_supported} />
            <CapabilityPill label="Autofill" ready={automationPlan.capability.autofill_supported} />
            <CapabilityPill label="Resume upload" ready={automationPlan.capability.resume_upload_supported} />
            <CapabilityPill label="Dry run" ready={automationPlan.capability.dry_run_supported} />
          </div>
          <div className="mt-4 space-y-2">
            {automationPlan.steps.map((step) => (
              <div className="rounded-xl bg-[#f6f8f5] p-3" key={step.order}>
                <p className="text-[12px] font-bold">{step.order}. {step.action.replaceAll("_", " ")}</p>
                <p className="mt-1 text-[11px] leading-5 text-[#65736f]">{step.description}</p>
              </div>
            ))}
          </div>
          {automationPlan.warnings.length ? <div className="mt-4 space-y-1">{automationPlan.warnings.map((warning) => <p className="text-[11px] font-bold text-[#a34f3f]" key={warning}>{warning}</p>)}</div> : null}
          <div className="mt-4 border-t border-[#edf0ed] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold">Assisted run tracking</h3>
                <p className="mt-1 text-[11px] leading-5 text-[#71807c]">Creates an auditable dry-run record. It blocks on missing materials, unsupported adapters, or quality warnings.</p>
              </div>
              <button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50" disabled={updating === selected.id} onClick={() => void startAutomationRun()}>Start assisted dry run</button>
            </div>
            <div className="mt-3 space-y-2">
              {automationRuns.length ? automationRuns.map((run) => (
                <div className="rounded-xl bg-[#f6f8f5] p-3" key={run.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] font-bold capitalize">{run.status.replaceAll("_", " ")}</p>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#176b5b]">{run.site_key}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#71807c]">Step: {run.current_step?.replaceAll("_", " ") ?? "Not started"} / {new Date(run.created_at).toLocaleString()}</p>
                  {typeof run.result.next_action === "string" ? <p className="mt-1 text-[11px] font-bold text-[#176b5b]">{run.result.next_action}</p> : null}
                  {run.warnings.length ? <div className="mt-2 space-y-1">{run.warnings.map((warning) => <p className="text-[11px] font-bold text-[#a34f3f]" key={warning}>{warning}</p>)}</div> : null}
                </div>
              )) : <p className="rounded-xl bg-[#f6f8f5] p-3 text-[11px] text-[#71807c]">No assisted runs recorded yet.</p>}
            </div>
          </div>
        </section>
        </>
      ) : null}

      {resumeDraft ? (
        <section className="mt-5 rounded-2xl border border-[#dce7e2] bg-white p-5 small-shadow">
          <div className="flex items-center gap-2 text-[#176b5b]"><FileText size={17} /><h2 className="text-[16px] font-bold">Editable tailored resume</h2></div>
          <p className="mt-2 text-[12px] text-[#71807c]">Edit only truthful resume evidence. Saved changes are used for DOCX and PDF downloads.</p>
          {resumeVersion ? <p className="mt-2 text-[11px] font-bold text-[#176b5b]">Export template: {resumeVersion.template_name}</p> : null}
          <label className="mt-4 block text-[12px] font-bold text-[#53645f]">Professional summary
            <textarea className="mt-2 min-h-28 w-full rounded-xl border border-[#dce7e2] p-3 text-[12px] font-normal leading-6 outline-none focus:border-[#79b6a8]" onChange={(event) => updateResumeDraft({ professional_summary: event.target.value })} value={resumeDraft.professional_summary ?? ""} />
          </label>
          <label className="mt-4 block text-[12px] font-bold text-[#53645f]">Skills, comma-separated
            <input className="mt-2 w-full rounded-xl border border-[#dce7e2] px-3 py-3 text-[12px] font-normal outline-none focus:border-[#79b6a8]" onChange={(event) => updateResumeSkills(event.target.value)} value={resumeDraft.skills.join(", ")} />
          </label>
          <div className="mt-4 space-y-3">
            <p className="text-[12px] font-bold text-[#53645f]">Experience</p>
            {resumeDraft.experience.map((experience, index) => (
              <div className="rounded-xl bg-[#f6f8f5] p-3" key={`${experience.company}-${experience.title}-${index}`}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => updateResumeExperience(index, "title", event.target.value)} placeholder="Title" value={experience.title} />
                  <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => updateResumeExperience(index, "company", event.target.value)} placeholder="Company" value={experience.company} />
                </div>
                <textarea className="mt-2 min-h-24 w-full rounded-lg border border-[#dce7e2] p-3 text-[12px] leading-6 outline-none focus:border-[#79b6a8]" onChange={(event) => updateResumeExperience(index, "description", event.target.value)} placeholder="Evidence-backed description" value={experience.description} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50" disabled={!resumeDraft.skills.length || !resumeDraft.experience.length} onClick={() => void saveResumeDraft()}>Save resume edits</button>
            {resumeSaved ? <p className="text-[12px] font-bold text-[#176b5b]">Saved</p> : null}
          </div>
        </section>
      ) : null}

      {selected ? (
        <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <div className="flex items-center gap-2 text-[#176b5b]"><CalendarPlus size={17} /><h2 className="text-[16px] font-bold">Interview schedule</h2></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setInterviewRound(event.target.value)} placeholder="Round, such as Recruiter screen" value={interviewRound} />
            <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} />
            <input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px] sm:col-span-2" onChange={(event) => setInterviewNotes(event.target.value)} placeholder="Optional preparation notes" value={interviewNotes} />
            <button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white sm:col-span-2" onClick={() => void scheduleInterview()}>{editingInterviewId ? "Update interview" : "Schedule interview"}</button>
          </div>
          <div className="mt-4 space-y-2">
            {interviews.length ? interviews.map((interview) => (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f6f8f5] p-3" key={interview.id}>
                <div>
                  <p className="text-[12px] font-bold">{interview.interview_round}</p>
                  <p className="mt-1 text-[11px] text-[#71807c]">{new Date(interview.scheduled_at).toLocaleString()}</p>
                  {interview.notes ? <p className="mt-1 text-[11px] text-[#71807c]">{interview.notes}</p> : null}
                </div>
                <div className="flex gap-2">
                  <button aria-label="Edit interview" className="text-[#176b5b]" onClick={() => editInterview(interview)}><Pencil size={14} /></button>
                  <button aria-label="Remove interview" className="text-[#a34f3f]" onClick={() => void removeInterview(interview.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            )) : <p className="text-[12px] text-[#91a09c]">No interviews scheduled yet.</p>}
          </div>
        </section>
      ) : null}

      {coverLetter || materials ? (
        <section className="mt-5 rounded-2xl border border-[#dce7e2] bg-white p-5 small-shadow">
          <div className="flex items-center gap-2 text-[#176b5b]"><FileText size={17} /><h2 className="text-[16px] font-bold">Evidence-grounded application draft</h2></div>
          <p className="mt-2 text-[12px] text-[#71807c]">Generated from your stored resume only. Edit the letter for tone, detail, and employer context before applying.</p>
          {materials ? <p className="mt-2 text-[11px] font-bold text-[#176b5b]">{materials.provenance === "gemini_evidence_grounded" ? "Gemini-enhanced grounded draft" : "Safe grounded fallback draft"} / {materials.generation_status.replaceAll("_", " ")} / {materials.retry_attempts} attempt{materials.retry_attempts === 1 ? "" : "s"}</p> : null}
          <textarea className="mt-4 min-h-80 w-full rounded-xl border border-[#dce7e2] bg-[#fbfcfa] p-4 text-[12px] leading-6 text-[#53645f] outline-none focus:border-[#79b6a8]" onChange={(event) => { setCoverLetterDraft(event.target.value); setCoverLetterSaved(false); }} value={coverLetterDraft} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50" disabled={coverLetterDraft.trim().length < 20} onClick={() => void saveCoverLetterDraft()}>Save edited letter</button>
            {coverLetterSaved ? <p className="text-[12px] font-bold text-[#176b5b]">Saved</p> : null}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function confirmAppliedStatus(): boolean {
  return window.confirm(APPLIED_CONFIRMATION_TEXT);
}

function eventSummary(event: ApplicationEvent): string {
  const metadata = event.metadata ?? {};
  if (event.event_type === "resume_generated") return `Tailored resume generated with ATS score ${String(metadata.ats_score ?? "--")}.`;
  if (event.event_type === "cover_letter_generated") return "Cover letter generated for this application.";
  if (event.event_type === "application_marked_applied") return "Application marked applied after manual submission.";
  if (event.event_type === "autofill_previewed") return `Reviewed ${String(metadata.field_count ?? 0)} suggested fields.`;
  if (event.event_type === "autofill_approved") return `Approved ${String(metadata.approved_field_count ?? 0)} field(s) for assisted autofill. Final submission remains manual.`;
  if (event.event_type === "autofill_attempted") {
    const filled = Array.isArray(metadata.filled) ? metadata.filled.length : 0;
    const skipped = Array.isArray(metadata.skipped) ? metadata.skipped.length : 0;
    return `${filled} field(s) filled, ${skipped} left for manual review. Final submission remains manual.`;
  }
  if (event.event_type === "autofill_failed") return `Autofill failed on the employer page: ${String(metadata.reason ?? "unknown browser/page restriction")}. Fill manually and submit yourself.`;
  if (event.event_type === "form_inspection_failed") return `Form inspection failed on the employer page: ${String(metadata.reason ?? "unknown browser/page restriction")}. Review fields manually.`;
  if (event.event_type === "resume_upload_attempted") return "Resume upload assistance was attempted; attach manually if the browser blocked file access.";
  if (event.event_type === "resume_upload_failed") return "Resume upload could not be automated in the browser; manual upload is required.";
  if (event.event_type === "resume_downloaded_for_upload") return `Tailored resume ${String(metadata.format ?? "file").toUpperCase()} downloaded for manual upload.`;
  if (event.event_type === "resume_export_downloaded") return `Tailored resume ${String(metadata.format ?? "file").toUpperCase()} exported in ${String(metadata.retry_attempts ?? 1)} attempt(s).`;
  if (event.event_type === "automation_dry_run_planned") return `Dry-run plan created for ${String(metadata.site_key ?? "career site")}.`;
  if (event.event_type === "automation_run_created") return `Assisted run ${String(metadata.run_status ?? "created")} for ${String(metadata.site_key ?? "career site")} with ${String(metadata.warning_count ?? 0)} warning(s).`;
  if (event.event_type === "prepare_job_queued") return `Material preparation job queued: ${String(metadata.background_job_id ?? "")}.`;
  if (event.event_type === "prepare_job_succeeded") return "Queued material preparation completed successfully.";
  if (event.event_type === "prepare_job_failed") return "Queued material preparation failed; retry from the workflow panel.";
  if (event.event_type === "prepare_job_retried") return `Material preparation job retried after ${String(metadata.attempts ?? 0)} previous attempt(s).`;
  if (event.event_type === "review_before_apply_opened") return `Review package opened with ${String(metadata.missing_field_count ?? 0)} field(s) needing attention.`;
  if (event.event_type === "review_before_apply_confirmed") return "User confirmed manual review before assisted application actions.";
  if (event.event_type === "extension_job_captured" || event.event_type === "extension_job_recaptured") return "Captured from the browser extension.";
  return "";
}

function CapabilityPill({ label, ready }: { label: string; ready: boolean }) {
  return <p className={`rounded-xl px-3 py-2 text-center text-[11px] font-bold ${ready ? "bg-[#e8f4ef] text-[#176b5b]" : "bg-[#fff4ef] text-[#a34f3f]"}`}>{label}: {ready ? "Supported" : "Manual"}</p>;
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#e8f4ef] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#71807c]">{label}</p>
      <p className="mt-2 text-[24px] font-bold tracking-[-0.06em] text-[#176b5b]">{value}</p>
    </div>
  );
}

function WorkflowStep({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className={`rounded-xl p-3 ${ready ? "bg-[#e8f4ef]" : "bg-[#fff4ef]"}`}>
      <p className={`text-[12px] font-bold ${ready ? "text-[#176b5b]" : "text-[#a34f3f]"}`}>{ready ? "Ready" : "Pending"}: {label}</p>
      <p className="mt-1 text-[11px] leading-5 text-[#65736f]">{detail}</p>
    </div>
  );
}
