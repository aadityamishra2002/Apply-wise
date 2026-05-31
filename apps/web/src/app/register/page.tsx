import { Check, ShieldCheck, Sparkles } from "lucide-react";

import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[.92fr_1.08fr]">
      <section className="flex flex-col px-6 py-6 md:px-12 lg:px-16">
        <Logo />
        <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#176b5b]">Start with your story</p>
          <h1 className="mt-2 text-[34px] font-bold tracking-[-0.065em]">Build a more focused search.</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#71807c]">Create your workspace, add your resume, and start reviewing roles that fit your real experience.</p>
          <AuthForm mode="register" />
        </div>
      </section>
      <section className="marketing-grid relative hidden overflow-hidden bg-[#ecf6f2] lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#eef8f3]/80 to-[#f4f8dc]/90" />
        <div className="relative flex h-full items-center justify-center p-14">
          <div className="max-w-lg">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#176b5b] text-white"><ShieldCheck size={19} /></div>
            <p className="mt-8 text-[32px] font-bold leading-[1.12] tracking-[-0.065em]">A job search workspace built around what is true.</p>
            <p className="mt-4 text-[14px] leading-6 text-[#65736f]">Your resume evidence stays at the center of every recommendation and tailored application.</p>
            <div className="mt-8 space-y-3">
              {["Secure account foundation", "Truthful resume tailoring", "Clear progress from search to offer"].map((item) => <p className="flex items-center gap-2 text-[12px] font-bold text-[#53645f]" key={item}><span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[#176b5b]"><Check size={12} /></span>{item}</p>)}
            </div>
            <div className="mt-8 flex items-center gap-2 rounded-xl bg-white/70 p-3 text-[11px] font-bold text-[#176b5b]"><Sparkles size={14} /> Free workspace · no credit card required</div>
          </div>
        </div>
      </section>
    </main>
  );
}
