import Link from "next/link";

import { Logo } from "@/components/logo";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fbfcf9] px-5 py-10 text-[#23312e]">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#e4e8e3] bg-white p-6 small-shadow md:p-8">
        <Logo />
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.14em] text-[#91a09c]">Terms of Service</p>
        <h1 className="mt-3 text-[34px] font-bold tracking-[-0.06em]">Apply Wise Terms</h1>
        <p className="mt-4 text-[13px] leading-6 text-[#65736f]">Last updated June 3, 2026. Apply Wise is a job-search productivity platform that helps users review job fit, prepare truthful resume and cover-letter drafts, and track applications.</p>

        <div className="mt-8 space-y-6 text-[13px] leading-6 text-[#53645f]">
          <section><h2 className="text-[17px] font-bold text-[#23312e]">User responsibility</h2><p className="mt-2">Users are responsible for reviewing all generated materials before use. Apply Wise does not guarantee interviews, offers, employment, or job-board acceptance.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Truthful use</h2><p className="mt-2">Generated drafts must be based on the user's real resume evidence. Users must not use the service to create false employers, fake skills, fabricated projects, or misleading qualifications.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Manual submission</h2><p className="mt-2">Apply Wise does not automatically submit job applications. Users remain responsible for reviewing employer forms, following employer and job-board terms, and submitting applications manually.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Acceptable use</h2><p className="mt-2">Users may not use Apply Wise for spam, mass unsolicited applications, scraping restricted websites, bypassing access controls, or violating third-party platform policies.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Contact</h2><p className="mt-2">For support or policy questions, contact <a className="font-bold text-[#176b5b]" href="mailto:aadityamishra1063@gmail.com">aadityamishra1063@gmail.com</a>.</p></section>
        </div>

        <Link className="mt-8 inline-flex rounded-full bg-[#176b5b] px-5 py-3 text-[13px] font-bold text-white" href="/">Back home</Link>
      </section>
    </main>
  );
}
