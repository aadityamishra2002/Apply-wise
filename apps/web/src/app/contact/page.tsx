import Link from "next/link";

import { Logo } from "@/components/logo";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#fbfcf9] px-5 py-10 text-[#23312e]">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#e4e8e3] bg-white p-6 small-shadow md:p-8">
        <Logo />
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.14em] text-[#91a09c]">Contact</p>
        <h1 className="mt-3 text-[34px] font-bold tracking-[-0.06em]">Contact Apply Wise</h1>
        <p className="mt-4 text-[13px] leading-6 text-[#65736f]">For support, privacy, billing, or product questions, email <a className="font-bold text-[#176b5b]" href="mailto:aadityamishra1063@gmail.com">aadityamishra1063@gmail.com</a>.</p>
        <div className="mt-8 rounded-2xl bg-[#f6f8f5] p-5 text-[13px] leading-6 text-[#53645f]">
          <p className="font-bold text-[#23312e]">Product note for reviewers</p>
          <p className="mt-2">Apply Wise is a user-reviewed resume tailoring, job-fit analysis, and application tracking platform. It does not automatically submit job applications or fabricate resume claims.</p>
        </div>
        <Link className="mt-8 inline-flex rounded-full bg-[#176b5b] px-5 py-3 text-[13px] font-bold text-white" href="/">Back home</Link>
      </section>
    </main>
  );
}
