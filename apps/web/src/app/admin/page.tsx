"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, FileText, LoaderCircle, Shield, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getAccessToken, loadAdminSummary, type AdminSummary } from "@/lib/api";

export default function AdminPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    void loadAdminSummary(token).then(setSummary).catch((loadError: Error) => setError(loadError.message));
  }, []);

  return (
    <AppShell eyebrow="Owner controls" title="Admin">
      {error ? <p className="rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{error}</p> : null}
      {!summary && !error ? <div className="grid min-h-[260px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" /></div> : null}
      {summary ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <AdminCard icon={<Users size={18} />} label="Users" value={summary.users} />
            <AdminCard icon={<BriefcaseBusiness size={18} />} label="Applications" value={summary.applications} />
            <AdminCard icon={<Shield size={18} />} label="Stored jobs" value={summary.jobs} />
            <AdminCard icon={<FileText size={18} />} label="Resume versions" value={summary.resume_versions} />
            <AdminCard icon={<FileText size={18} />} label="Cover letters" value={summary.cover_letters} />
          </section>
          <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <h2 className="text-[16px] font-bold">Subscriptions</h2>
            <div className="mt-4 flex flex-wrap gap-2">{Object.entries(summary.subscriptions).length ? Object.entries(summary.subscriptions).map(([plan, count]) => <span className="rounded-full bg-[#e8f4ef] px-3 py-1 text-[12px] font-bold capitalize text-[#176b5b]" key={plan}>{plan}: {count}</span>) : <p className="text-[12px] text-[#71807c]">No subscription rows yet.</p>}</div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function AdminCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><div className="text-[#176b5b]">{icon}</div><p className="mt-4 text-[22px] font-bold">{value}</p><p className="mt-1 text-[12px] font-bold text-[#71807c]">{label}</p></div>;
}
