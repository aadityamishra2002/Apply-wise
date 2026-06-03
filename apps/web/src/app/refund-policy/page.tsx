import Link from "next/link";

import { Logo } from "@/components/logo";

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[#fbfcf9] px-5 py-10 text-[#23312e]">
      <section className="mx-auto max-w-3xl rounded-3xl border border-[#e4e8e3] bg-white p-6 small-shadow md:p-8">
        <Logo />
        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.14em] text-[#91a09c]">Refund and Cancellation Policy</p>
        <h1 className="mt-3 text-[34px] font-bold tracking-[-0.06em]">Current Billing Status</h1>
        <p className="mt-4 text-[13px] leading-6 text-[#65736f]">Last updated June 3, 2026. Apply Wise is currently in free beta and does not collect subscription payments inside the product.</p>

        <div className="mt-8 space-y-6 text-[13px] leading-6 text-[#53645f]">
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Free beta</h2><p className="mt-2">Because paid checkout is not active, there are currently no paid subscriptions to cancel and no paid charges to refund.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Future paid plans</h2><p className="mt-2">If paid plans are introduced, pricing, renewal terms, cancellation rules, and refund eligibility will be shown before purchase.</p></section>
          <section><h2 className="text-[17px] font-bold text-[#23312e]">Support</h2><p className="mt-2">For billing questions, contact <a className="font-bold text-[#176b5b]" href="mailto:aadityamishra1063@gmail.com">aadityamishra1063@gmail.com</a>.</p></section>
        </div>

        <Link className="mt-8 inline-flex rounded-full bg-[#176b5b] px-5 py-3 text-[13px] font-bold text-white" href="/">Back home</Link>
      </section>
    </main>
  );
}
