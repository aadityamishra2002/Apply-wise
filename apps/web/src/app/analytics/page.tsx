"use client";

import { useEffect, useState } from "react";
import { BarChart3, BriefcaseBusiness, CalendarCheck2, LoaderCircle, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/ui";
import { getAccessToken, loadAnalyticsSummary, loadSkillRecommendations, type AnalyticsSummary, type SkillRecommendation } from "@/lib/api";

const statuses = ["saved", "preparing", "applied", "interview", "rejected", "offer", "withdrawn"];
const emptyAnalytics: AnalyticsSummary = { total_applications: 0, interview_rate: 0, offer_rate: 0, status_counts: {} };

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(emptyAnalytics);
  const [recommendations, setRecommendations] = useState<SkillRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const token = getAccessToken(); if (token) void Promise.all([loadAnalyticsSummary(token), loadSkillRecommendations(token)]).then(([analytics, skills]) => { setSummary(analytics); setRecommendations(skills); }).finally(() => setLoading(false)); else setLoading(false); }, []);
  const maxCount = Math.max(...Object.values(summary.status_counts), 1);
  return <AppShell eyebrow="Search intelligence" title="Analytics">
    {loading ? <div className="grid min-h-[300px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin"/></div> : <>
      <section className="grid gap-4 sm:grid-cols-3"><StatCard icon={<BriefcaseBusiness size={18}/>} label="Tracked roles" value={String(summary.total_applications)} detail="Your complete pipeline"/><StatCard icon={<CalendarCheck2 size={18}/>} label="Interview rate" value={`${summary.interview_rate}%`} detail="Applications in interview" tone="lime"/><StatCard icon={<Trophy size={18}/>} label="Offer rate" value={`${summary.offer_rate}%`} detail="Applications with offers" tone="amber"/></section>
      <section className="mt-6 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><div className="flex items-center gap-2"><BarChart3 className="text-[#176b5b]" size={18}/><h2 className="text-[16px] font-bold">Pipeline distribution</h2></div><p className="mt-1 text-[12px] text-[#91a09c]">A live view of the statuses you maintain in your application tracker.</p><div className="mt-6 space-y-4">{statuses.map((status) => { const count = summary.status_counts[status] ?? 0; return <div key={status}><div className="mb-1.5 flex justify-between text-[12px] font-bold capitalize"><span>{status}</span><span className="text-[#71807c]">{count}</span></div><div className="h-2 rounded-full bg-[#edf0ed]"><div className="h-2 rounded-full bg-[#79b6a8]" style={{width:`${(count/maxCount)*100}%`}}/></div></div>; })}</div></section>
      <section className="mt-6 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow"><div className="flex items-center gap-2"><BarChart3 className="text-[#176b5b]" size={18}/><h2 className="text-[16px] font-bold">Skill recommendations</h2></div><p className="mt-1 text-[12px] text-[#91a09c]">Learning feedback from missing skills across your matched and approved roles.</p><div className="mt-4 space-y-3">{recommendations.length ? recommendations.map((recommendation) => <div className="rounded-xl bg-[#f6f8f5] p-4" key={recommendation.skill}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[13px] font-bold">{recommendation.skill}</p><p className="text-[11px] font-bold text-[#176b5b]">{recommendation.mention_count} role{recommendation.mention_count === 1 ? "" : "s"}</p></div><p className="mt-2 text-[12px] leading-5 text-[#71807c]">{recommendation.reason}</p>{recommendation.approved_role_count || recommendation.high_fit_role_count ? <p className="mt-2 text-[11px] font-bold text-[#66801f]">{recommendation.approved_role_count} approved / {recommendation.high_fit_role_count} high ATS</p> : null}</div>) : <p className="rounded-xl border border-dashed border-[#d5dedb] p-5 text-center text-[12px] text-[#91a09c]">Search or capture more jobs to build personalized skill recommendations.</p>}</div></section>
    </>}
  </AppShell>;
}
