"use client";

import { useEffect, useState } from "react";
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
  createInterview,
  deleteInterview,
  downloadCoverLetter,
  downloadResumeVersion,
  getAccessToken,
  loadApplicationEvents,
  loadApplicationAutomationPlan,
  loadApplications,
  loadAssistedApplicationChecklist,
  loadCoverLetter,
  loadInterviews,
  loadResumeVersion,
  prepareApplication,
  saveCoverLetter,
  saveResumeVersion,
  updateApplication,
  updateInterview,
  type ApplicationEvent,
  type ApplicationAutomationPlan,
  type ApplicationMaterials,
  type ApplicationRecord,
  type AssistedApplicationChecklist,
  type CoverLetterRecord,
  type ResumeContentDraft,
  type ResumeVersionDetail,
  type InterviewRecord,
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
  const [coverLetter, setCoverLetter] = useState<CoverLetterRecord | null>(null);
  const [coverLetterDraft, setCoverLetterDraft] = useState("");
  const [coverLetterSaved, setCoverLetterSaved] = useState(false);
  const [resumeVersion, setResumeVersion] = useState<ResumeVersionDetail | null>(null);
  const [resumeDraft, setResumeDraft] = useState<ResumeContentDraft | null>(null);
  const [resumeSaved, setResumeSaved] = useState(false);

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
    const loadedAutomationPlan = await loadApplicationAutomationPlan(application.id, token).catch(() => null);
    setEvents(loadedEvents);
    setInterviews(loadedInterviews);
    setChecklist(loadedChecklist);
    setAutomationPlan(loadedAutomationPlan);
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

  async function changeStatus(applicationId: string, status: string) {
    const token = getAccessToken();
    if (!token) return;
    setUpdating(applicationId);
    try {
      const updated = await updateApplication(applicationId, { status }, token);
      setApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (selected?.id === updated.id) void inspect(updated);
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
      setResumeVersion(preparedResume);
      setResumeDraft(preparedResume.resume_content);
      setResumeSaved(false);
      setCoverLetter({ id: prepared.cover_letter_id, content: prepared.cover_letter, created_at: new Date().toISOString() });
      setCoverLetterDraft(prepared.cover_letter);
      setCoverLetterSaved(false);
      setApplications((current) => current.map((item) => (item.id === prepared.application.id ? prepared.application : item)));
      await inspect(prepared.application);
    } finally {
      setUpdating(null);
    }
  }

  async function markApplied() {
    if (!selected) return;
    await changeStatus(selected.id, "applied");
  }

  function downloadPrepared(format: "docx" | "pdf") {
    const token = getAccessToken();
    const versionId = materials?.resume_version_id ?? checklist?.resume_version_id;
    if (token && versionId) void downloadResumeVersion(versionId, format, token);
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

  return (
    <AppShell eyebrow="Application tracker" title="Your pipeline">
      {loading ? (
        <div className="grid min-h-[300px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" /></div>
      ) : applications.length ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
          <section className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <h2 className="text-[16px] font-bold">Saved opportunities</h2>
            <div className="mt-4 space-y-3">
              {applications.map((application) => (
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
              ))}
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
          <p className="mt-2 text-[12px] text-[#71807c]">Save a recommended job to start your tracker.</p>
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
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={!preparedVersionId} onClick={() => downloadPrepared("docx")}><Download size={13} />Resume DOCX</button>
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={!preparedVersionId} onClick={() => downloadPrepared("pdf")}><Download size={13} />Resume PDF</button>
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={!preparedCoverLetterId} onClick={() => downloadPreparedCoverLetter()}><Download size={13} />Cover letter TXT</button>
            <a className="inline-flex items-center gap-1 rounded-lg bg-[#1c2926] px-3 py-2 text-[12px] font-bold text-white" href={checklist.target_url} rel="noreferrer" target="_blank"><ExternalLink size={13} />Open employer page</a>
            <button className="inline-flex items-center gap-1 rounded-lg bg-[#fff4ef] px-3 py-2 text-[12px] font-bold text-[#a34f3f] disabled:opacity-50" disabled={selectedIsApplied || updating === selected.id} onClick={() => void markApplied()}><CheckCircle2 size={13} />Mark applied</button>
          </div>
          <p className="mt-3 text-[11px] font-bold text-[#a34f3f]">Manual final submission required. Review every employer field before submitting.</p>
        </section>
      ) : null}

      {selected && automationPlan ? (
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
        </section>
      ) : null}

      {resumeDraft ? (
        <section className="mt-5 rounded-2xl border border-[#dce7e2] bg-white p-5 small-shadow">
          <div className="flex items-center gap-2 text-[#176b5b]"><FileText size={17} /><h2 className="text-[16px] font-bold">Editable tailored resume</h2></div>
          <p className="mt-2 text-[12px] text-[#71807c]">Edit only truthful resume evidence. Saved changes are used for DOCX and PDF downloads.</p>
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
          {materials ? <p className="mt-2 text-[11px] font-bold text-[#176b5b]">{materials.provenance === "gemini_evidence_grounded" ? "Gemini-enhanced grounded draft" : "Safe grounded fallback draft"}</p> : null}
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

function eventSummary(event: ApplicationEvent): string {
  const metadata = event.metadata ?? {};
  if (event.event_type === "autofill_previewed") return `Reviewed ${String(metadata.field_count ?? 0)} suggested fields.`;
  if (event.event_type === "autofill_attempted") {
    const filled = Array.isArray(metadata.filled) ? metadata.filled.length : 0;
    const skipped = Array.isArray(metadata.skipped) ? metadata.skipped.length : 0;
    return `${filled} field(s) filled, ${skipped} left for manual review. Final submission remains manual.`;
  }
  if (event.event_type === "resume_upload_attempted") return "Resume upload assistance was attempted; attach manually if the browser blocked file access.";
  if (event.event_type === "resume_downloaded_for_upload") return `Tailored resume ${String(metadata.format ?? "file").toUpperCase()} downloaded for manual upload.`;
  if (event.event_type === "automation_dry_run_planned") return `Dry-run plan created for ${String(metadata.site_key ?? "career site")}.`;
  if (event.event_type === "extension_job_captured" || event.event_type === "extension_job_recaptured") return "Captured from the browser extension.";
  return "";
}

function CapabilityPill({ label, ready }: { label: string; ready: boolean }) {
  return <p className={`rounded-xl px-3 py-2 text-center text-[11px] font-bold ${ready ? "bg-[#e8f4ef] text-[#176b5b]" : "bg-[#fff4ef] text-[#a34f3f]"}`}>{label}: {ready ? "Supported" : "Manual"}</p>;
}

function WorkflowStep({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className={`rounded-xl p-3 ${ready ? "bg-[#e8f4ef]" : "bg-[#fff4ef]"}`}>
      <p className={`text-[12px] font-bold ${ready ? "text-[#176b5b]" : "text-[#a34f3f]"}`}>{ready ? "Ready" : "Pending"}: {label}</p>
      <p className="mt-1 text-[11px] leading-5 text-[#65736f]">{detail}</p>
    </div>
  );
}
