import { BriefcaseBusiness, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";

const columns = ["Saved", "Preparing", "Applied", "Interview", "Rejected"];

export default function ApplicationsPage() {
  return (
    <AppShell
      eyebrow="Application tracker"
      title="Your pipeline"
      actions={<button className="flex items-center gap-1.5 rounded-lg bg-[#b7c9c4] px-3 py-2 text-[12px] font-bold text-white" disabled><Plus size={14} /> Add application</button>}
    >
      <section className="flex flex-col gap-3 rounded-2xl border border-[#e4e8e3] bg-white p-4 small-shadow md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[16px] font-bold tracking-[-0.03em]">Application board</h2>
          <p className="mt-1 text-[12px] text-[#91a09c]">Your tracker starts empty and will only contain opportunities you save.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-[#e1e7e4] bg-[#fbfcfa] px-3 py-2 opacity-70">
          <Search size={15} className="text-[#91a09c]" />
          <input className="bg-transparent text-[12px] outline-none placeholder:text-[#a3aeab]" disabled placeholder="Search applications" />
        </label>
      </section>

      <section className="mt-5 rounded-2xl border border-dashed border-[#d5dedb] bg-white p-8 text-center">
        <BriefcaseBusiness className="mx-auto text-[#91a09c]" size={22} />
        <h2 className="mt-3 text-[16px] font-bold">No applications yet</h2>
        <p className="mx-auto mt-2 max-w-lg text-[12px] leading-5 text-[#71807c]">Persistent application tracking is the next workflow being connected. Your real activity will appear here once you begin saving roles.</p>
      </section>

      <section className="mt-5 overflow-x-auto pb-4 thin-scrollbar">
        <div className="grid min-w-[1180px] grid-cols-5 gap-3">
          {columns.map((column) => (
            <div className="rounded-2xl bg-[#f0f3f0] p-3" key={column}>
              <div className="flex items-center gap-2 px-1 pb-3">
                <span className={`h-2 w-2 rounded-full ${column === "Interview" ? "bg-[#94b936]" : column === "Rejected" ? "bg-[#c9a6a0]" : "bg-[#64a999]"}`} />
                <h3 className="text-[12px] font-bold">{column}</h3>
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-bold text-[#91a09c]">0</span>
              </div>
              <div className="rounded-xl border border-dashed border-[#ccd6d2] p-5 text-center text-[11px] font-bold text-[#a0aba8]">No applications</div>
            </div>
          ))}
        </div>
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}
