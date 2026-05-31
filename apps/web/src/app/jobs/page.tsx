"use client";

import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, BriefcaseBusiness, Check, ChevronRight, Filter, MapPin, Search, Sparkles, WandSparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MatchRing, Pill } from "@/components/ui";
import { jobs, type Job } from "@/lib/mock-data";

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Job>(jobs[0]);
  const [saved, setSaved] = useState<Set<string>>(new Set(jobs.filter((job) => job.saved).map((job) => job.id)));
  const filteredJobs = useMemo(() => {
    const value = query.toLowerCase();
    return jobs.filter((job) => `${job.title} ${job.company} ${job.matching.join(" ")}`.toLowerCase().includes(value));
  }, [query]);

  function toggleSaved(id: string) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AppShell
      eyebrow="Job discovery"
      title="Find your next role"
      actions={<button className="rounded-lg border border-[#dfe6e2] bg-white px-3 py-2 text-[12px] font-bold text-[#65736f]"><span className="hidden sm:inline">Saved jobs </span>({saved.size})</button>}
    >
      <section className="rounded-2xl border border-[#dce7e2] bg-gradient-to-r from-[#eaf6f2] to-[#f8faed] p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#176b5b]">Smart discovery</p>
        <h2 className="mt-1.5 text-[21px] font-bold tracking-[-0.05em]">Search once. Spend your energy on the right roles.</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-[#dce6e2] bg-white px-3.5 py-3">
            <Search className="text-[#8b9895]" size={17} />
            <input className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#a3aeab]" onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, companies, or skills" value={query} />
          </label>
          <button className="flex items-center justify-center gap-2 rounded-xl border border-[#dce6e2] bg-white px-4 py-3 text-[12px] font-bold text-[#65736f]"><Filter size={15} /> Filters</button>
          <button className="rounded-xl bg-[#176b5b] px-5 py-3 text-[12px] font-bold text-white">Search jobs</button>
        </div>
      </section>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
        {["All recommendations", "90%+ match", "Remote", "Posted this week", "Product engineering"].map((filter, index) => (
          <button className={`whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-bold ${index === 0 ? "border-[#cde3dc] bg-[#eaf7f2] text-[#176b5b]" : "border-[#e1e7e4] bg-white text-[#70807c]"}`} key={filter}>{filter}</button>
        ))}
      </div>

      <section className="mt-5 grid gap-5 xl:grid-cols-[.91fr_1.09fr]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div><h2 className="text-[16px] font-bold tracking-[-0.03em]">{filteredJobs.length} recommended roles</h2><p className="mt-1 text-[11px] text-[#8b9895]">Ranked for your resume and preferences</p></div>
            <p className="text-[11px] font-bold text-[#8b9895]">Best match first</p>
          </div>
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <button className={`w-full rounded-2xl border bg-white p-4 text-left transition ${selected.id === job.id ? "border-[#85b7aa] shadow-md" : "border-[#e4e8e3] hover:border-[#b9d4cd]"}`} key={job.id} onClick={() => setSelected(job)}>
                <div className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1c2926] text-[14px] font-bold text-white">{job.initials}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-[#71807c]">{job.company}</p>
                    <p className="mt-0.5 truncate text-[14px] font-bold tracking-[-0.025em]">{job.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-[#91a09c]"><MapPin size={11} /> {job.location} · {job.mode}</p>
                  </div>
                  <MatchRing score={job.match} small />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex gap-1.5 overflow-hidden">
                    {job.matching.slice(0, 3).map((skill) => <Pill tone="green" key={skill}>{skill}</Pill>)}
                  </div>
                  <ChevronRight className="shrink-0 text-[#a2aeaa]" size={16} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow xl:sticky xl:top-[90px]">
          <div className="flex gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#1c2926] text-[16px] font-bold text-white">{selected.initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-[#71807c]">{selected.company}</p>
              <h2 className="mt-1 text-[19px] font-bold tracking-[-0.04em]">{selected.title}</h2>
              <p className="mt-1 text-[11px] text-[#91a09c]">{selected.location} · {selected.mode} · {selected.posted}</p>
            </div>
            <button aria-label="Save role" className="grid h-9 w-9 place-items-center rounded-xl border border-[#e2e8e5] text-[#176b5b]" onClick={() => toggleSaved(selected.id)}>
              {saved.has(selected.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-[#f6f8f5] p-3">
            <div><p className="text-[18px] font-bold tracking-[-0.05em] text-[#176b5b]">{selected.match}%</p><p className="mt-1 text-[10px] font-bold text-[#91a09c]">Overall match</p></div>
            <div><p className="text-[18px] font-bold tracking-[-0.05em]">{selected.matching.length}</p><p className="mt-1 text-[10px] font-bold text-[#91a09c]">Skills aligned</p></div>
            <div><p className="text-[18px] font-bold tracking-[-0.05em]">High</p><p className="mt-1 text-[10px] font-bold text-[#91a09c]">Priority</p></div>
          </div>

          <div className="mt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Why you match</h3>
            <div className="mt-3 space-y-2">
              {selected.matching.map((skill) => <div className="flex items-center gap-2 text-[12px] text-[#53645f]" key={skill}><span className="grid h-5 w-5 place-items-center rounded-full bg-[#e8f4ef] text-[#176b5b]"><Check size={12} /></span>{skill}</div>)}
            </div>
          </div>
          <div className="mt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Worth addressing</h3>
            <div className="mt-3 flex flex-wrap gap-2">{selected.missing.map((skill) => <Pill tone="amber" key={skill}>{skill}</Pill>)}</div>
          </div>
          <div className="mt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">About the role</h3>
            <p className="mt-3 text-[13px] leading-6 text-[#65736f]">{selected.description}</p>
            <p className="mt-3 text-[12px] font-bold text-[#176b5b]">{selected.salary}</p>
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button className="flex items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white"><WandSparkles size={15} /> Prepare application</button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-[#e1e7e4] px-4 py-3 text-[12px] font-bold text-[#65736f]"><BriefcaseBusiness size={15} /> View job post</button>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f4f8f2] p-3 text-[11px] leading-5 text-[#65736f]">
            <Sparkles className="mt-0.5 shrink-0 text-[#176b5b]" size={14} />
            Your tailored resume will only use verified experience from your master resume.
          </div>
        </div>
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}

