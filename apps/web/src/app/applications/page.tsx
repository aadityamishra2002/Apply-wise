"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/ui";
import { getAccessToken, loadApplications, type ApplicationRecord } from "@/lib/api";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const token = getAccessToken(); if (token) void loadApplications(token).then(setApplications).finally(() => setLoading(false)); }, []);
  return <AppShell eyebrow="Application tracker" title="Your pipeline">
    {loading ? <div className="grid min-h-[300px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin"/></div> : applications.length ? <section className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><h2 className="text-[16px] font-bold">Saved opportunities</h2><div className="mt-4 space-y-3">{applications.map((application) => <div className="flex items-center justify-between rounded-xl border border-[#edf0ed] p-4" key={application.id}><div><p className="text-[13px] font-bold">{application.title}</p><p className="mt-1 text-[12px] text-[#71807c]">{application.company}</p></div><Pill tone="amber">{application.status}</Pill></div>)}</div></section> : <section className="rounded-2xl border border-dashed border-[#d5dedb] bg-white p-8 text-center"><BriefcaseBusiness className="mx-auto text-[#91a09c]"/><h2 className="mt-3 text-[16px] font-bold">No applications yet</h2><p className="mt-2 text-[12px] text-[#71807c]">Save a recommended job to start your tracker.</p></section>}
  </AppShell>;
}
