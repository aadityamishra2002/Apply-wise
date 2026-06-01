import Link from "next/link";
import { FileText, Filter, Search, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";

export default function JobsPage() {
  return (
    <AppShell
      eyebrow="Job discovery"
      title="Find your next role"
      actions={<button className="rounded-lg border border-[#dfe6e2] bg-white px-3 py-2 text-[12px] font-bold text-[#65736f]" disabled>Saved jobs (0)</button>}
    >
      <section className="rounded-2xl border border-[#dce7e2] bg-gradient-to-r from-[#eaf6f2] to-[#f8faed] p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#176b5b]">Smart discovery</p>
        <h2 className="mt-1.5 text-[21px] font-bold tracking-[-0.05em]">Live job search is the next workflow being connected.</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#65736f]">Your account starts with no recommendations. Once resume parsing and live providers are connected, results will be ranked against your verified profile.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-[#dce6e2] bg-white px-3.5 py-3 opacity-70">
            <Search className="text-[#8b9895]" size={17} />
            <input className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#a3aeab]" disabled placeholder="Search will be enabled with live providers" />
          </label>
          <button className="flex items-center justify-center gap-2 rounded-xl border border-[#dce6e2] bg-white px-4 py-3 text-[12px] font-bold text-[#91a09c]" disabled><Filter size={15} /> Filters</button>
          <button className="rounded-xl bg-[#b7c9c4] px-5 py-3 text-[12px] font-bold text-white" disabled>Search jobs</button>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-8 text-center small-shadow">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f4ef] text-[#176b5b]"><Search size={21} /></div>
        <h2 className="mt-4 text-[17px] font-bold tracking-[-0.03em]">No job recommendations yet</h2>
        <p className="mx-auto mt-2 max-w-lg text-[13px] leading-6 text-[#71807c]">We will only show opportunities sourced from connected providers and scored against resume evidence that belongs to you.</p>
        <Link className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white" href="/resume"><FileText size={15} /> Review resume setup</Link>
      </section>

      <section className="mt-5 flex items-start gap-3 rounded-2xl border border-[#dce7e2] bg-[#f4f8f2] p-4">
        <ShieldCheck className="mt-0.5 shrink-0 text-[#176b5b]" size={18} />
        <div>
          <p className="text-[13px] font-bold">Truthful matching only</p>
          <p className="mt-1 text-[12px] leading-5 text-[#65736f]">Match scores and tailored resumes will only use verified experience from your master resume.</p>
        </div>
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}
