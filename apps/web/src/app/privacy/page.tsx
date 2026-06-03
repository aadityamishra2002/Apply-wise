import Link from "next/link";

import { Logo } from "@/components/logo";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fbfcf9] px-5 py-10 text-[#23312e]">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#e4e8e3] bg-white p-6 small-shadow md:p-8">
        <Logo />
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.14em] text-[#91a09c]">Privacy Policy</p>
        <h1 className="mt-3 text-[34px] font-bold tracking-[-0.06em]">How Apply Wise Handles Data</h1>
        <p className="mt-4 text-[13px] leading-6 text-[#65736f]">Last updated June 3, 2026. This policy explains the main categories of data used by Apply Wise.</p>

        <div className="mt-8 space-y-6 text-[13px] leading-6 text-[#53645f]">
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Data we collect</h2><p className="mt-2">Apply Wise stores account email, uploaded resume text, extracted resume evidence, saved jobs, generated drafts, application statuses, notes, and interview records.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">How data is used</h2><p className="mt-2">Data is used to provide resume-aware matching, ATS-readiness analysis, user-reviewed draft generation, application tracking, analytics, and account security.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">AI providers</h2><p className="mt-2">When AI drafting is enabled, relevant resume and job-description evidence may be sent to configured AI providers to generate grounded drafts. Deterministic fallback drafting remains available.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Security</h2><p className="mt-2">Passwords are hashed. Refresh tokens are stored securely and can be revoked through logout or password change. Production secrets are not stored in the public repository.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Contact</h2><p className="mt-2">For privacy requests, contact <a className="font-bold text-[#176b5b]" href="mailto:aadityamishra1063@gmail.com">aadityamishra1063@gmail.com</a>.</p></section>
        </div>

        <Link className="mt-8 inline-flex rounded-full bg-[#176b5b] px-5 py-3 text-[13px] font-bold text-white" href="/">Back home</Link>
      </section>
    </main>
  );
}
