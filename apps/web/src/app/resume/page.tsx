import { CloudUpload, FileText, ShieldCheck, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";

export default function ResumePage() {
  return (
    <AppShell eyebrow="Profile foundation" title="My resume">
      <section className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Master resume</p>
            <div className="mt-4 rounded-2xl border border-dashed border-[#b8d4cc] bg-[#f6fbf9] p-6 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e2f2ec] text-[#176b5b]"><CloudUpload size={20} /></div>
              <p className="mt-4 text-[13px] font-bold">Resume upload is being connected</p>
              <p className="mt-1 text-[11px] leading-5 text-[#91a09c]">PDF and DOCX parsing will be available in the next product slice.</p>
              <button className="mt-4 rounded-lg bg-[#b7c9c4] px-4 py-2.5 text-[11px] font-bold text-white" disabled>Upload coming next</button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#dce7e2] bg-gradient-to-br from-[#e8f4ef] to-[#f5f9e7] p-5">
            <ShieldCheck className="text-[#176b5b]" size={21} />
            <p className="mt-3 text-[14px] font-bold">Truthful tailoring, always.</p>
            <p className="mt-2 text-[12px] leading-5 text-[#65736f]">applywise will only rephrase and reorganize verified experience. It will never invent skills, projects, or impact.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.04em]">Extracted profile</h2>
            <p className="mt-1 text-[12px] text-[#91a09c]">Your parsed resume evidence will appear here after uploads are connected.</p>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-[#d5dedb] bg-[#fbfcfa] p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f4ef] text-[#176b5b]"><FileText size={21} /></div>
            <h3 className="mt-4 text-[15px] font-bold">No resume profile yet</h3>
            <p className="mx-auto mt-2 max-w-lg text-[12px] leading-5 text-[#71807c]">Skills, experience, education, and certifications will only appear after they are extracted from your uploaded resume.</p>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#f6f8f5] p-4">
            <Sparkles size={17} className="mt-0.5 shrink-0 text-[#176b5b]" />
            <p className="text-[12px] leading-5 text-[#65736f]">Once your real profile is available, matching and tailoring can be grounded in evidence that belongs to you.</p>
          </div>
        </div>
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}
