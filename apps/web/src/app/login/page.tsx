import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[.92fr_1.08fr]">
      <section className="flex flex-col px-6 py-6 md:px-12 lg:px-16">
        <Logo />
        <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#176b5b]">Welcome back</p>
          <h1 className="mt-2 text-[34px] font-bold tracking-[-0.065em]">Keep your search moving.</h1>
          <p className="mt-2 text-[14px] leading-6 text-[#71807c]">Log in to review matches, tailor applications, and see your progress.</p>
          <form className="mt-7 space-y-4">
            <label className="block"><span className="text-[12px] font-bold text-[#53645f]">Email address</span><input className="mt-2 w-full rounded-xl border border-[#dde5e1] px-3.5 py-3 text-[13px] outline-none focus:border-[#85b7aa]" placeholder="avery@example.com" type="email" /></label>
            <label className="block"><span className="text-[12px] font-bold text-[#53645f]">Password</span><input className="mt-2 w-full rounded-xl border border-[#dde5e1] px-3.5 py-3 text-[13px] outline-none focus:border-[#85b7aa]" placeholder="Your password" type="password" /></label>
            <div className="flex items-center justify-between text-[11px] font-bold">
              <label className="flex items-center gap-2 text-[#71807c]"><input type="checkbox" /> Remember me</label>
              <a className="text-[#176b5b]" href="#">Forgot password?</a>
            </div>
            <Link className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3.5 text-[13px] font-bold text-white" href="/dashboard">Log in <ArrowRight size={15} /></Link>
          </form>
          <p className="mt-6 text-center text-[12px] text-[#8b9895]">New to applywise? <Link className="font-bold text-[#176b5b]" href="/dashboard">Create a free account</Link></p>
        </div>
      </section>
      <section className="marketing-grid relative hidden overflow-hidden bg-[#ecf6f2] lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#eef8f3]/80 to-[#f4f8dc]/90" />
        <div className="relative flex h-full items-center justify-center p-14">
          <div className="max-w-lg">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#176b5b] text-white"><Sparkles size={19} /></div>
            <p className="mt-8 text-[32px] font-bold leading-[1.12] tracking-[-0.065em]">“I stopped applying everywhere and started applying with purpose.”</p>
            <p className="mt-4 text-[14px] leading-6 text-[#65736f]">A calm, focused workspace for finding work that actually fits.</p>
            <div className="mt-8 space-y-3">
              {["Understand your fit before you apply", "Tailor every resume without inventing claims", "Keep your whole search in one place"].map((item) => <p className="flex items-center gap-2 text-[12px] font-bold text-[#53645f]" key={item}><span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[#176b5b]"><Check size={12} /></span>{item}</p>)}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

