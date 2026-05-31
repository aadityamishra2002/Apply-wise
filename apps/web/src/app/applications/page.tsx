import { CalendarDays, MoreHorizontal, Plus, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/ui";
import { boardApplications } from "@/lib/mock-data";

const columns = ["Saved", "Preparing", "Applied", "Interview", "Rejected"];

export default function ApplicationsPage() {
  return (
    <AppShell
      eyebrow="Application tracker"
      title="Your pipeline"
      actions={<button className="flex items-center gap-1.5 rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white"><Plus size={14} /> Add application</button>}
    >
      <section className="flex flex-col gap-3 rounded-2xl border border-[#e4e8e3] bg-white p-4 small-shadow md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[16px] font-bold tracking-[-0.03em]">Application board</h2>
          <p className="mt-1 text-[12px] text-[#91a09c]">Keep every opportunity moving forward.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-[#e1e7e4] bg-[#fbfcfa] px-3 py-2">
          <Search size={15} className="text-[#91a09c]" />
          <input className="bg-transparent text-[12px] outline-none placeholder:text-[#a3aeab]" placeholder="Search applications" />
        </label>
      </section>

      <section className="mt-5 overflow-x-auto pb-4 thin-scrollbar">
        <div className="grid min-w-[1180px] grid-cols-5 gap-3">
          {columns.map((column) => {
            const cards = boardApplications.filter((application) => application.status === column);
            return (
              <div className="rounded-2xl bg-[#f0f3f0] p-3" key={column}>
                <div className="flex items-center justify-between px-1 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${column === "Interview" ? "bg-[#94b936]" : column === "Rejected" ? "bg-[#c9a6a0]" : "bg-[#64a999]"}`} />
                    <h3 className="text-[12px] font-bold">{column}</h3>
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-bold text-[#91a09c]">{cards.length}</span>
                  </div>
                  <button className="text-[#91a09c]"><Plus size={15} /></button>
                </div>
                <div className="space-y-2.5">
                  {cards.map((card) => (
                    <div className="rounded-xl border border-[#e1e6e3] bg-white p-3 small-shadow" key={card.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#1c2926] text-[11px] font-bold text-white">{card.company.slice(0, 1)}</div>
                        <button className="text-[#a0aba8]"><MoreHorizontal size={15} /></button>
                      </div>
                      <p className="mt-3 text-[12px] font-bold leading-5">{card.title}</p>
                      <p className="mt-1 text-[11px] font-bold text-[#71807c]">{card.company}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-[#f0f2f0] pt-3">
                        <Pill tone={card.match >= 85 ? "green" : "amber"}>{card.match}% match</Pill>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[#a0aba8]"><CalendarDays size={11} /> {card.date}</span>
                      </div>
                    </div>
                  ))}
                  <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[#ccd6d2] p-2.5 text-[11px] font-bold text-[#91a09c]"><Plus size={13} /> Add card</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}

