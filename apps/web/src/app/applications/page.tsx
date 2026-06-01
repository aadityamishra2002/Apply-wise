"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, FileText, LoaderCircle, WandSparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getAccessToken, loadApplications, prepareApplication, updateApplicationStatus, type ApplicationMaterials, type ApplicationRecord } from "@/lib/api";

const statuses = ["saved", "preparing", "applied", "interview", "rejected", "offer", "withdrawn"];

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [materials, setMaterials] = useState<ApplicationMaterials | null>(null);
  useEffect(() => { const token = getAccessToken(); if (token) void loadApplications(token).then(setApplications).finally(() => setLoading(false)); }, []);
  async function changeStatus(applicationId: string, status: string) {
    const token = getAccessToken(); if (!token) return;
    setUpdating(applicationId);
    try { const updated = await updateApplicationStatus(applicationId, status, token); setApplications((current) => current.map((item) => item.id === updated.id ? updated : item)); }
    finally { setUpdating(null); }
  }
  async function prepare(applicationId: string) {
    const token = getAccessToken(); if (!token) return;
    setUpdating(applicationId);
    try { const prepared = await prepareApplication(applicationId, token); setMaterials(prepared); setApplications((current) => current.map((item) => item.id === prepared.application.id ? prepared.application : item)); }
    finally { setUpdating(null); }
  }
  return <AppShell eyebrow="Application tracker" title="Your pipeline">
    {loading ? <div className="grid min-h-[300px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin"/></div> : applications.length ? <section className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><h2 className="text-[16px] font-bold">Saved opportunities</h2><div className="mt-4 space-y-3">{applications.map((application) => <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#edf0ed] p-4" key={application.id}><div><p className="text-[13px] font-bold">{application.title}</p><p className="mt-1 text-[12px] text-[#71807c]">{application.company}</p></div><div className="flex items-center gap-2"><button className="flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:opacity-50" disabled={updating === application.id} onClick={() => void prepare(application.id)}><WandSparkles size={13}/>Prepare draft</button><select aria-label={`Status for ${application.title}`} className="rounded-lg border border-[#dce7e2] bg-[#fbfcfa] px-3 py-2 text-[12px] font-bold capitalize text-[#176b5b]" disabled={updating === application.id} onChange={(event) => void changeStatus(application.id, event.target.value)} value={application.status}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></div>)}</div></section> : <section className="rounded-2xl border border-dashed border-[#d5dedb] bg-white p-8 text-center"><BriefcaseBusiness className="mx-auto text-[#91a09c]"/><h2 className="mt-3 text-[16px] font-bold">No applications yet</h2><p className="mt-2 text-[12px] text-[#71807c]">Save a recommended job to start your tracker.</p></section>}
    {materials ? <section className="mt-5 rounded-2xl border border-[#dce7e2] bg-white p-5 small-shadow"><div className="flex items-center gap-2 text-[#176b5b]"><FileText size={17}/><h2 className="text-[16px] font-bold">Evidence-grounded application draft</h2></div><p className="mt-2 text-[12px] text-[#71807c]">Generated from your stored resume only. Review every line before applying.</p><pre className="mt-4 whitespace-pre-wrap rounded-xl bg-[#fbfcfa] p-4 text-[12px] leading-6 text-[#53645f]">{materials.cover_letter}</pre></section> : null}
  </AppShell>;
}
