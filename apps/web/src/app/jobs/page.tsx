"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Check, FileText, LoaderCircle, MapPin, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MatchRing, Pill } from "@/components/ui";
import { captureManualJob, getAccessToken, loadJobRecommendations, saveJob, type JobRecommendation, type ManualJob } from "@/lib/api";

const emptyManualJob: ManualJob = { title: "", company: "", location: "", url: "", description: "" };

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRecommendation[]>([]);
  const [selected, setSelected] = useState<JobRecommendation | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showCapture, setShowCapture] = useState(false);
  const [manualJob, setManualJob] = useState(emptyManualJob);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    void loadJobRecommendations(token).then((items) => { setJobs(items); setSelected(items[0] ?? null); }).catch((loadError: Error) => setError(loadError.message)).finally(() => setLoading(false));
  }, []);

  async function searchJobs() {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true); setError(null);
    try { const items = await loadJobRecommendations(token, query); setJobs(items); setSelected(items[0] ?? null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load job recommendations."); }
    finally { setLoading(false); }
  }

  async function persistSavedJob(jobId: string) {
    const token = getAccessToken();
    if (!token) return;
    try { await saveJob(jobId, token); setSaved((current) => new Set(current).add(jobId)); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save this job."); }
  }
  async function captureJob() { const token=getAccessToken(); if(!token) return; setError(null); try { const job=await captureManualJob(manualJob,token); setJobs((current)=>[job,...current.filter((item)=>item.id!==job.id)]); setSelected(job); setManualJob(emptyManualJob); setShowCapture(false); } catch(captureError){setError(captureError instanceof Error ? captureError.message : "Could not capture this job.");} }

  return <AppShell eyebrow="Job discovery" title="Resume-aware recommendations" actions={<Link className="rounded-lg border border-[#dfe6e2] bg-white px-3 py-2 text-[12px] font-bold text-[#65736f]" href="/applications">Saved jobs ({saved.size})</Link>}>
    <form className="mb-5 flex gap-2 rounded-2xl border border-[#e4e8e3] bg-white p-3 small-shadow" onSubmit={(event) => { event.preventDefault(); void searchJobs(); }}>
      <input aria-label="Search jobs" className="min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none placeholder:text-[#a0aba8]" onChange={(event) => setQuery(event.target.value)} placeholder="Search roles or keywords, such as Python developer" value={query}/>
      <button className="flex items-center gap-1.5 rounded-xl bg-[#176b5b] px-4 py-2.5 text-[12px] font-bold text-white" type="submit"><Search size={14}/>Search</button>
    </form>
    <div className="mb-5"><button className="flex items-center gap-1.5 text-[12px] font-bold text-[#176b5b]" onClick={() => setShowCapture((current) => !current)}><Plus size={14}/>{showCapture ? "Close job capture" : "Paste a job from any career page"}</button>{showCapture ? <div className="mt-3 grid gap-2 rounded-2xl border border-[#e4e8e3] bg-white p-4 small-shadow sm:grid-cols-2"><input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event)=>setManualJob({...manualJob,title:event.target.value})} placeholder="Job title" value={manualJob.title}/><input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event)=>setManualJob({...manualJob,company:event.target.value})} placeholder="Company" value={manualJob.company}/><input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event)=>setManualJob({...manualJob,location:event.target.value})} placeholder="Location" value={manualJob.location}/><input className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event)=>setManualJob({...manualJob,url:event.target.value})} placeholder="Job page URL" value={manualJob.url}/><textarea className="min-h-28 rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px] sm:col-span-2" onChange={(event)=>setManualJob({...manualJob,description:event.target.value})} placeholder="Paste the job description" value={manualJob.description}/><button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white sm:col-span-2" onClick={() => void captureJob()}>Score captured job</button></div> : null}</div>
    {error ? <p className="mb-4 rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{error}</p> : null}
    {loading ? <div className="grid min-h-[360px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" /></div> : jobs.length ? (
      <section className="grid gap-5 xl:grid-cols-[.92fr_1.08fr]">
        <div className="space-y-3">
          <h2 className="text-[16px] font-bold">{jobs.length} profile-scored roles</h2>
          {jobs.map((job) => <button className={`w-full rounded-2xl border bg-white p-4 text-left ${selected?.id === job.id ? "border-[#85b7aa]" : "border-[#e4e8e3]"}`} key={job.id} onClick={() => setSelected(job)}>
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1c2926] font-bold text-white">{job.company[0]}</div><div className="flex-1"><p className="text-[12px] font-bold text-[#71807c]">{job.company}</p><p className="text-[14px] font-bold">{job.title}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-[#91a09c]"><MapPin size={11}/>{job.location}</p></div><MatchRing score={job.match_score} small /></div>
          </button>)}
        </div>
        {selected ? <div className="h-fit rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <p className="text-[12px] font-bold text-[#71807c]">{selected.company}</p><h2 className="mt-1 text-[20px] font-bold">{selected.title}</h2><p className="mt-2 text-[12px] text-[#91a09c]">{selected.location} · {selected.work_mode}</p>
          <div className="mt-4 flex flex-wrap gap-2">{selected.matching_skills.map((skill) => <Pill tone="green" key={skill}><Check size={11}/>{skill}</Pill>)}</div>
          <p className="mt-5 text-[13px] leading-6 text-[#65736f]">{selected.description}</p>
          <button className="mt-5 flex items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white disabled:opacity-60" disabled={saved.has(selected.id)} onClick={() => void persistSavedJob(selected.id)}><Bookmark size={15}/>{saved.has(selected.id) ? "Saved to tracker" : "Save job"}</button>
        </div> : null}
      </section>
    ) : <section className="rounded-2xl border border-[#e4e8e3] bg-white p-8 text-center small-shadow"><Search className="mx-auto text-[#91a09c]" /><h2 className="mt-4 text-[17px] font-bold">Upload your resume first</h2><p className="mt-2 text-[13px] text-[#71807c]">Recommendations are scored from your persisted resume evidence.</p><Link className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white" href="/resume"><FileText size={15}/>Add resume</Link></section>}
    {jobs.some((job) => job.source === "adzuna") ? <p className="mt-5 text-[11px] font-bold text-[#91a09c]">Jobs by <a className="text-[#176b5b] underline" href="https://www.adzuna.in/" rel="noreferrer" target="_blank">Adzuna</a>. Manually captured career-page roles are labeled separately.</p> : null}
  </AppShell>;
}
