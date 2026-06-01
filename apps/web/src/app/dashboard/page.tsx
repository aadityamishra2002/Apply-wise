"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, BriefcaseBusiness, CalendarCheck2, CircleCheckBig, FileText, LoaderCircle, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/ui";
import { getAccessToken, loadDashboardSummary, type DashboardSummary } from "@/lib/api";

const emptySummary: DashboardSummary = { applications: 0, interviews: 0, saved_jobs: 0, average_match_score: null, weekly_activity: [0, 0, 0, 0, 0, 0, 0] };
const days = ["M", "T", "W", "T", "F", "S", "S"];

export default function DashboardPage() {
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = getAccessToken();
    if (token) void loadDashboardSummary(token).then(setSummary).finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  const maxActivity = Math.max(...summary.weekly_activity, 1);
  return <AppShell eyebrow="Workspace overview" title="Welcome to your workspace" actions={<Link className="hidden rounded-lg bg-[#176b5b] px-3.5 py-2 text-[12px] font-bold text-white sm:block" href="/resume">Add resume</Link>}>
    <section className="rounded-2xl border border-[#dce7e2] bg-gradient-to-r from-[#eaf6f2] to-[#f4f8dc] p-5 md:flex md:items-center md:justify-between md:p-6"><div><p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#176b5b]">Your next move</p><h2 className="mt-1.5 text-[22px] font-bold tracking-[-0.05em]">Build your evidence-backed job pipeline.</h2><p className="mt-2 text-[13px] text-[#65736f]">Upload your resume, review scored matches, and keep every opportunity current.</p></div><Link className="mt-4 flex w-fit items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white md:mt-0" href="/jobs">Review matches <ArrowRight size={15}/></Link></section>
    {loading ? <div className="grid min-h-[180px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin"/></div> : <>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={<BriefcaseBusiness size={18}/>} label="Applications" value={String(summary.applications)} detail="Tracked opportunities"/><StatCard icon={<CalendarCheck2 size={18}/>} label="Interviews" value={String(summary.interviews)} detail="Active interview loops" tone="lime"/><StatCard icon={<Bookmark size={18}/>} label="Saved roles" value={String(summary.saved_jobs)} detail="Ready for review" tone="amber"/><StatCard icon={<CircleCheckBig size={18}/>} label="Avg. match" value={summary.average_match_score === null ? "--" : `${summary.average_match_score}%`} detail="Persisted match scores" tone="blue"/></section>
      <section className="mt-6 grid gap-5 xl:grid-cols-[1.28fr_.72fr]"><div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><h2 className="text-[16px] font-bold">Workflow</h2><p className="mt-1 text-[12px] text-[#8b9895]">Your workspace is backed by your resume and saved opportunities.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{[[FileText,"Resume","/resume"],[Search,"Matches","/jobs"],[BriefcaseBusiness,"Pipeline","/applications"]].map(([Icon,label,href]) => <Link className="rounded-xl border border-[#edf0ed] p-4 text-[13px] font-bold text-[#176b5b] transition hover:border-[#b9d4cd]" href={href as string} key={href as string}><Icon size={17}/><span className="mt-3 block">{label as string}</span></Link>)}</div></div><div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><h2 className="text-[16px] font-bold">Application activity</h2><p className="mt-1 text-[12px] text-[#8b9895]">Your past 7 days</p><div className="mt-7 flex h-[138px] items-end gap-3">{summary.weekly_activity.map((count,index) => <div className="flex h-full flex-1 flex-col justify-end gap-2" key={`${days[index]}-${index}`}><div className="min-h-1 rounded-t-md bg-[#79b6a8]" style={{height:`${Math.max((count/maxActivity)*100,4)}%`}}/><span className="text-center text-[10px] font-bold text-[#a0aba8]">{days[index]}</span></div>)}</div></div></section>
    </>}
    <div className="h-16 lg:hidden"/>
  </AppShell>;
}
