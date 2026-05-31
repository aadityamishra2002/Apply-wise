import { Check, CloudUpload, Download, FileText, Pencil, Plus, ShieldCheck, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/ui";

export default function ResumePage() {
  return (
    <AppShell eyebrow="Profile foundation" title="My resume">
      <section className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Master resume</p>
            <div className="mt-4 rounded-2xl border border-dashed border-[#b8d4cc] bg-[#f6fbf9] p-6 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e2f2ec] text-[#176b5b]"><CloudUpload size={20} /></div>
              <p className="mt-4 text-[13px] font-bold">Drop a resume here</p>
              <p className="mt-1 text-[11px] text-[#91a09c]">PDF or DOCX · max 10 MB</p>
              <button className="mt-4 rounded-lg bg-[#176b5b] px-4 py-2.5 text-[11px] font-bold text-white">Choose file</button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f4ef] text-[#176b5b]"><FileText size={18} /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold">avery-kim-master-resume.pdf</p>
                <p className="mt-1 text-[11px] text-[#91a09c]">Uploaded May 28 · 248 KB</p>
              </div>
              <button className="text-[#71807c]"><Download size={16} /></button>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#f3f8e6] p-3 text-[11px] font-bold text-[#66801f]"><Check size={14} /> Parsed and ready to use</div>
          </div>

          <div className="rounded-2xl border border-[#dce7e2] bg-gradient-to-br from-[#e8f4ef] to-[#f5f9e7] p-5">
            <ShieldCheck className="text-[#176b5b]" size={21} />
            <p className="mt-3 text-[14px] font-bold">Truthful tailoring, always.</p>
            <p className="mt-2 text-[12px] leading-5 text-[#65736f]">applywise only rephrases and reorganizes verified experience. It never invents skills, projects, or impact.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <div className="flex items-center justify-between">
            <div><h2 className="text-[17px] font-bold tracking-[-0.04em]">Extracted profile</h2><p className="mt-1 text-[12px] text-[#91a09c]">Review what your copilot uses for matching and tailoring.</p></div>
            <button className="flex items-center gap-1.5 rounded-lg border border-[#e1e7e4] px-3 py-2 text-[11px] font-bold text-[#65736f]"><Pencil size={13} /> Edit profile</button>
          </div>

          <div className="mt-6 border-t border-[#edf0ed] pt-5">
            <div className="flex items-center justify-between"><h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Skills</h3><button className="flex items-center gap-1 text-[11px] font-bold text-[#176b5b]"><Plus size={13} /> Add skill</button></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["React", "TypeScript", "Python", "PostgreSQL", "Product strategy", "SQL", "Docker", "Analytics", "FastAPI", "SaaS"].map((skill, index) => <Pill tone={index < 7 ? "green" : "lime"} key={skill}>{skill}</Pill>)}
            </div>
          </div>

          <div className="mt-6 border-t border-[#edf0ed] pt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Experience</h3>
            <div className="mt-4 space-y-5">
              {[
                ["Senior Product Engineer", "Northstar Labs", "2022 - Present", "Owned customer-facing SaaS workflows, improved activation by 24%, and led a platform migration across three product teams."],
                ["Software Engineer", "Brightwork", "2019 - 2022", "Built React and TypeScript product surfaces, Python services, and analytics tooling for a collaborative planning product."],
              ].map(([title, company, dates, detail]) => (
                <div className="relative border-l-2 border-[#dce9e4] pl-4" key={company}>
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[#176b5b]" />
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[13px] font-bold">{title}</p><p className="text-[11px] font-bold text-[#91a09c]">{dates}</p></div>
                  <p className="mt-1 text-[12px] font-bold text-[#176b5b]">{company}</p>
                  <p className="mt-2 text-[12px] leading-5 text-[#71807c]">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-[#edf0ed] pt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Profile quality</h3>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f6f8f5] p-3">
              <Sparkles size={17} className="text-[#176b5b]" />
              <p className="flex-1 text-[12px] text-[#65736f]"><strong className="text-[#33433f]">Strong foundation.</strong> Adding two more quantified outcomes could improve tailored resume quality.</p>
              <Pill tone="green">88%</Pill>
            </div>
          </div>
        </div>
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}

