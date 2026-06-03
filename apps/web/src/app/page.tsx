import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileCheck2,
  Search,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { MatchRing, Pill } from "@/components/ui";

export default function Home() {
  return (
    <main className="overflow-hidden bg-[#fbfcf9]">
      <header className="border-b border-[#e9ece8] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-[13px] font-bold text-[#65736f] md:flex">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link className="hidden text-[13px] font-bold text-[#4d5e5a] sm:block" href="/login">Log in</Link>
            <Link className="rounded-full bg-[#176b5b] px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#0c4d42]" href="/dashboard">
              Start for free
            </Link>
          </div>
        </div>
      </header>

      <section className="marketing-grid relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#f8fcf7]/60 via-[#fbfcf9]/90 to-[#fbfcf9]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dce9e3] bg-white px-3 py-1.5 text-[11px] font-bold text-[#176b5b] small-shadow">
              <Sparkles size={13} />
              Your job search, thoughtfully accelerated
            </div>
            <h1 className="mt-7 max-w-3xl text-[48px] font-bold leading-[1.01] tracking-[-0.075em] text-[#172321] sm:text-[66px]">
              Land work that <span className="text-[#176b5b]">fits you.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-7 text-[#65736f]">
              Find the right roles, understand your fit, and create tailored applications with an AI copilot that keeps your search honest and organized.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link className="flex items-center gap-2 rounded-full bg-[#176b5b] px-5 py-3.5 text-[13px] font-bold text-white shadow-md transition hover:bg-[#0c4d42]" href="/dashboard">
                Build my workspace <ArrowRight size={16} />
              </Link>
              <a className="rounded-full border border-[#dce4df] bg-white px-5 py-3.5 text-[13px] font-bold text-[#4c5b57]" href="#how-it-works">
                See how it works
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-bold text-[#70807c]">
              {["Free to start", "No credit card", "You stay in control"].map((item) => (
                <span className="flex items-center gap-1.5" key={item}><Check className="text-[#176b5b]" size={14} />{item}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <div className="absolute -left-10 top-20 h-36 w-36 rounded-full bg-[#e8f2bf] blur-3xl" />
            <div className="absolute -right-10 bottom-16 h-40 w-40 rounded-full bg-[#bde2d8] blur-3xl" />
            <div className="relative rounded-[26px] border border-[#e1e7e3] bg-white p-4 soft-shadow sm:p-5">
              <div className="flex items-center justify-between border-b border-[#edf0ed] pb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Recommended for you</p>
                  <p className="mt-1 text-[16px] font-bold tracking-[-0.03em]">High-fit opportunities</p>
                </div>
                <Pill tone="green">12 new today</Pill>
              </div>
              <div className="mt-4 rounded-2xl border border-[#dfe8e4] bg-[#fbfdfb] p-4">
                <div className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#171717] text-[16px] font-bold text-white">L</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-[#71807c]">Linear</p>
                    <p className="mt-0.5 text-[15px] font-bold tracking-[-0.03em]">Senior Product Engineer</p>
                    <p className="mt-1 text-[11px] text-[#8a9995]">Remote · $175k - $220k</p>
                  </div>
                  <MatchRing score={94} small />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["React", "TypeScript", "Product strategy"].map((skill) => <Pill tone="green" key={skill}>{skill}</Pill>)}
                  <Pill>+3 skills</Pill>
                </div>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-lg bg-[#176b5b] px-3 py-2 text-[11px] font-bold text-white">Prepare application</span>
                  <span className="rounded-lg border border-[#e2e8e5] px-3 py-2 text-[11px] font-bold text-[#65736f]">Save job</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  ["94%", "Match score"],
                  ["88%", "ATS score"],
                  ["6", "Skills matched"],
                ].map(([value, label]) => (
                  <div className="rounded-xl bg-[#f6f8f5] p-3" key={label}>
                    <p className="text-[17px] font-bold tracking-[-0.05em] text-[#176b5b]">{value}</p>
                    <p className="mt-1 text-[10px] font-bold text-[#8a9995]">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e8ece8] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-10 gap-y-4 px-5 py-5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#9aa6a3]">
          <span>Built for focused job seekers</span><span>Truthful tailoring</span><span>ATS-aware resumes</span><span>One organized search</span>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28" id="features">
        <div className="mx-auto max-w-2xl text-center">
          <Pill tone="green">A calmer way to apply</Pill>
          <h2 className="mt-5 text-[38px] font-bold tracking-[-0.065em] sm:text-[48px]">Everything you need to move with intention.</h2>
          <p className="mt-4 text-[15px] leading-7 text-[#70807c]">Less spreadsheet wrangling. More clarity about where to spend your energy.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            [Target, "See your real fit", "Rank opportunities against your verified experience and understand which requirements you already meet."],
            [WandSparkles, "Tailor with integrity", "Create ATS-aware resumes and cover letters from your real work history. No invented claims."],
            [BarChart3, "Keep momentum visible", "Track applications, interviews, and outcomes in one clean workspace that helps you learn."],
          ].map(([Icon, title, body]) => (
            <div className="rounded-2xl border border-[#e4e8e3] bg-white p-6 small-shadow" key={title as string}>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f4ef] text-[#176b5b]"><Icon size={20} /></div>
              <h3 className="mt-6 text-[18px] font-bold tracking-[-0.04em]">{title as string}</h3>
              <p className="mt-3 text-[14px] leading-6 text-[#70807c]">{body as string}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#e8ece8] bg-[#f4f8f2]" id="how-it-works">
        <div className="mx-auto max-w-7xl px-5 py-20 md:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <Pill tone="lime">Three simple steps</Pill>
              <h2 className="mt-5 text-[38px] font-bold leading-[1.04] tracking-[-0.065em]">From scattered search to focused action.</h2>
            </div>
            <div className="grid gap-3">
              {[
                [Search, "01", "Discover strong-fit roles", "Search once and rank opportunities against your resume."],
                [FileCheck2, "02", "Prepare a truthful application", "Generate tailored materials grounded in your experience."],
                [BarChart3, "03", "Track and learn", "See what is working and keep every application moving."],
              ].map(([Icon, number, title, body]) => (
                <div className="flex gap-4 rounded-2xl border border-[#e0e8df] bg-white p-5" key={number as string}>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f4ef] text-[#176b5b]"><Icon size={18} /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold tracking-[0.12em] text-[#91a09c]">STEP {number as string}</p>
                    <p className="mt-1 text-[15px] font-bold">{title as string}</p>
                    <p className="mt-1 text-[13px] leading-5 text-[#70807c]">{body as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8" id="pricing">
        <div className="mx-auto max-w-2xl text-center">
          <Pill tone="green">Transparent beta pricing</Pill>
          <h2 className="mt-5 text-[38px] font-bold tracking-[-0.065em] sm:text-[48px]">Start free while Apply Wise is in beta.</h2>
          <p className="mt-4 text-[15px] leading-7 text-[#70807c]">Paid plans are not active yet. When billing is enabled, users will be able to review pricing before subscribing.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#e4e8e3] bg-white p-6 small-shadow">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Current plan</p>
            <h3 className="mt-3 text-[24px] font-bold tracking-[-0.05em]">Free beta</h3>
            <p className="mt-2 text-[34px] font-bold tracking-[-0.07em] text-[#176b5b]">₹0</p>
            <p className="mt-3 text-[13px] leading-6 text-[#70807c]">Resume upload, job discovery, ATS-aware scoring, user-reviewed drafts, and application tracking.</p>
          </div>
          <div className="rounded-2xl border border-dashed border-[#b8d4cc] bg-[#f6fbf9] p-6">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Planned</p>
            <h3 className="mt-3 text-[24px] font-bold tracking-[-0.05em]">Pro workspace</h3>
            <p className="mt-2 text-[13px] leading-6 text-[#70807c]">Paid features will be launched only after payment-provider approval, with clear cancellation and refund terms.</p>
          </div>
        </div>
      </section>

      <footer className="bg-[#173b35] px-5 py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-[22px] font-bold tracking-[-0.05em]">Your next role deserves a smarter search.</p>
            <p className="mt-2 text-[13px] text-[#b8d3cd]">Start with a resume. Leave with a plan.</p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <Link className="flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-[13px] font-bold text-[#176b5b]" href="/dashboard">
              Start for free <ArrowRight size={15} />
            </Link>
            <div className="flex flex-wrap gap-4 text-[12px] font-bold text-[#b8d3cd]">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/refund-policy">Refund policy</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
