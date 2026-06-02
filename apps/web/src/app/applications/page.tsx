"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, CalendarPlus, Clock3, Download, FileText, LoaderCircle, Pencil, Save, Trash2, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createInterview, deleteInterview, downloadResumeVersion, getAccessToken, loadApplicationEvents, loadApplications, loadAssistedApplicationChecklist, loadInterviews, prepareApplication, updateApplication, updateInterview, type ApplicationEvent, type ApplicationMaterials, type ApplicationRecord, type AssistedApplicationChecklist, type InterviewRecord } from "@/lib/api";

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
  useEffect(() => { const token = getAccessToken(); if (token) void loadApplications(token).then((items) => { setApplications(items); if (items[0]) void inspect(items[0]); }).finally(() => setLoading(false)); }, []);
  async function inspect(application: ApplicationRecord) {
    const token = getAccessToken(); if (!token) return;
    setSelected(application); setNotes(application.notes ?? "");
    setEvents(await loadApplicationEvents(application.id, token));
    setInterviews(await loadInterviews(application.id, token));
    setChecklist(await loadAssistedApplicationChecklist(application.id, token));
  }
  async function scheduleInterview() {
    const token = getAccessToken(); if (!token || !selected || !interviewRound || !scheduledAt) return;
    setUpdating(selected.id);
    try { const payload={interview_round:interviewRound,scheduled_at:new Date(scheduledAt).toISOString(),notes:interviewNotes || null}; if(editingInterviewId) await updateInterview(selected.id, editingInterviewId, payload, token); else await createInterview(selected.id, payload, token); setInterviewRound(""); setScheduledAt(""); setInterviewNotes(""); setEditingInterviewId(null); setApplications((current) => current.map((item) => item.id === selected.id ? {...item,status:"interview"} : item)); void inspect({...selected,status:"interview"}); }
    finally { setUpdating(null); }
  }
  function editInterview(interview: InterviewRecord) { setEditingInterviewId(interview.id); setInterviewRound(interview.interview_round); setScheduledAt(new Date(interview.scheduled_at).toISOString().slice(0,16)); setInterviewNotes(interview.notes ?? ""); }
  async function removeInterview(interviewId: string) { const token=getAccessToken(); if(!token || !selected) return; await deleteInterview(selected.id,interviewId,token); if(editingInterviewId===interviewId){setEditingInterviewId(null);setInterviewRound("");setScheduledAt("");setInterviewNotes("");} void inspect(selected); }
  async function changeStatus(applicationId: string, status: string) {
    const token = getAccessToken(); if (!token) return;
    setUpdating(applicationId);
    try { const updated = await updateApplication(applicationId, {status}, token); setApplications((current) => current.map((item) => item.id === updated.id ? updated : item)); if (selected?.id === updated.id) void inspect(updated); }
    finally { setUpdating(null); }
  }
  async function saveNotes() {
    const token = getAccessToken(); if (!token || !selected) return;
    setUpdating(selected.id);
    try { const updated = await updateApplication(selected.id, {notes}, token); setApplications((current) => current.map((item) => item.id === updated.id ? updated : item)); void inspect(updated); }
    finally { setUpdating(null); }
  }
  async function prepare(applicationId: string) {
    const token = getAccessToken(); if (!token) return;
    setUpdating(applicationId);
    try { const prepared = await prepareApplication(applicationId, token); setMaterials(prepared); setApplications((current) => current.map((item) => item.id === prepared.application.id ? prepared.application : item)); void inspect(prepared.application); }
    finally { setUpdating(null); }
  }
  function download(format: "docx" | "pdf") {
    const token = getAccessToken(); if (token && materials) void downloadResumeVersion(materials.resume_version_id, format, token);
  }
  return <AppShell eyebrow="Application tracker" title="Your pipeline">
    {loading ? <div className="grid min-h-[300px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin"/></div> : applications.length ? <div className="grid gap-5 xl:grid-cols-[1fr_.9fr]"><section className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><h2 className="text-[16px] font-bold">Saved opportunities</h2><div className="mt-4 space-y-3">{applications.map((application) => <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${selected?.id === application.id ? "border-[#85b7aa]" : "border-[#edf0ed]"}`} key={application.id} onClick={() => void inspect(application)}><div><p className="text-[13px] font-bold">{application.title}</p><p className="mt-1 text-[12px] text-[#71807c]">{application.company}</p></div><div className="flex items-center gap-2"><button className="flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={updating === application.id} onClick={(event) => { event.stopPropagation(); void prepare(application.id); }}><WandSparkles size={13}/>Prepare draft</button><select aria-label={`Status for ${application.title}`} className="rounded-lg border border-[#dce7e2] bg-[#fbfcfa] px-3 py-2 text-[12px] font-bold capitalize text-[#176b5b]" disabled={updating === application.id} onChange={(event) => void changeStatus(application.id, event.target.value)} onClick={(event) => event.stopPropagation()} value={application.status}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div>)}</div></section>{selected ? <section className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><h2 className="text-[16px] font-bold">Application workspace</h2><p className="mt-1 text-[12px] text-[#71807c]">{selected.title} / {selected.company}</p><textarea className="mt-4 min-h-28 w-full rounded-xl border border-[#dce7e2] p-3 text-[12px] outline-none focus:border-[#79b6a8]" onChange={(event) => setNotes(event.target.value)} placeholder="Add follow-up notes, recruiter context, or next steps." value={notes}/><button className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white" onClick={() => void saveNotes()}><Save size={13}/>Save notes</button><div className="mt-5 border-t border-[#edf0ed] pt-4"><div className="flex items-center gap-2"><Clock3 className="text-[#176b5b]" size={15}/><h3 className="text-[13px] font-bold">Activity timeline</h3></div><div className="mt-3 space-y-2">{events.length ? events.map((event) => <div className="rounded-lg bg-[#f6f8f5] p-3 text-[11px] text-[#65736f]" key={event.id}><p className="font-bold capitalize">{event.event_type.replace("_"," ")}</p><p className="mt-1">{event.from_status && event.to_status ? `${event.from_status} → ${event.to_status}` : "Application note updated"}</p></div>) : <p className="text-[12px] text-[#91a09c]">No activity recorded yet.</p>}</div></div></section> : null}</div> : <section className="rounded-2xl border border-dashed border-[#d5dedb] bg-white p-8 text-center"><BriefcaseBusiness className="mx-auto text-[#91a09c]"/><h2 className="mt-3 text-[16px] font-bold">No applications yet</h2><p className="mt-2 text-[12px] text-[#71807c]">Save a recommended job to start your tracker.</p></section>}
    {selected&&checklist ? <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><h2 className="text-[16px] font-bold">Assisted application readiness</h2><p className="mt-1 text-[12px] text-[#71807c]">Apply Wise prepares the materials. You review the employer form and submit it manually.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{[["Duplicate prevention",checklist.duplicate_prevention],["ATS role approved",checklist.ats_approved],["Tailored resume prepared",checklist.resume_prepared],["Cover letter prepared",checklist.cover_letter_prepared]].map(([label,ready])=><p className={`rounded-lg p-3 text-[12px] font-bold ${ready?"bg-[#e8f4ef] text-[#176b5b]":"bg-[#fff4ef] text-[#a34f3f]"}`} key={String(label)}>{ready?"Ready":"Pending"}: {label}</p>)}</div><a className="mt-4 inline-flex rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white" href={checklist.target_url} rel="noreferrer" target="_blank">Open employer page</a><p className="mt-3 text-[11px] font-bold text-[#a34f3f]">Manual final submission required. Review every employer field before submitting.</p></section> : null}
    {selected ? <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><div className="flex items-center gap-2 text-[#176b5b]"><CalendarPlus size={17}/><h2 className="text-[16px] font-bold">Interview schedule</h2></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setInterviewRound(event.target.value)} placeholder="Round, such as Recruiter screen" value={interviewRound}/><input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt}/><input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px] sm:col-span-2" onChange={(event) => setInterviewNotes(event.target.value)} placeholder="Optional preparation notes" value={interviewNotes}/><button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white sm:col-span-2" onClick={() => void scheduleInterview()}>{editingInterviewId ? "Update interview" : "Schedule interview"}</button></div><div className="mt-4 space-y-2">{interviews.length ? interviews.map((interview) => <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f6f8f5] p-3" key={interview.id}><div><p className="text-[12px] font-bold">{interview.interview_round}</p><p className="mt-1 text-[11px] text-[#71807c]">{new Date(interview.scheduled_at).toLocaleString()}</p>{interview.notes ? <p className="mt-1 text-[11px] text-[#71807c]">{interview.notes}</p> : null}</div><div className="flex gap-2"><button aria-label="Edit interview" className="text-[#176b5b]" onClick={() => editInterview(interview)}><Pencil size={14}/></button><button aria-label="Remove interview" className="text-[#a34f3f]" onClick={() => void removeInterview(interview.id)}><Trash2 size={14}/></button></div></div>) : <p className="text-[12px] text-[#91a09c]">No interviews scheduled yet.</p>}</div></section> : null}
    {materials ? <section className="mt-5 rounded-2xl border border-[#dce7e2] bg-white p-5 small-shadow"><div className="flex items-center gap-2 text-[#176b5b]"><FileText size={17}/><h2 className="text-[16px] font-bold">Evidence-grounded application draft</h2></div><p className="mt-2 text-[12px] text-[#71807c]">Generated from your stored resume only. Review every line before applying.</p><p className="mt-2 text-[11px] font-bold text-[#176b5b]">{materials.provenance === "gemini_evidence_grounded" ? "Gemini-enhanced grounded draft" : "Safe grounded fallback draft"}</p><div className="mt-3 flex gap-2"><button className="flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => download("docx")}><Download size={13}/>Download DOCX</button><button className="flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => download("pdf")}><Download size={13}/>Download PDF</button></div><pre className="mt-4 whitespace-pre-wrap rounded-xl bg-[#fbfcfa] p-4 text-[12px] leading-6 text-[#53645f]">{materials.cover_letter}</pre></section> : null}
  </AppShell>;
}
