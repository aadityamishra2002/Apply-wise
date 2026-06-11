import { PolicyLayout } from "@/components/policy-layout";

export default function RefundPolicyPage() {
  return (
    <PolicyLayout
      eyebrow="Refund and Cancellation Policy"
      title="Refunds for Apply Wise Digital SaaS Plans"
      description="Last updated June 11, 2026. Apply Wise is a digital SaaS product. This policy applies when paid plans are active."
    >
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Refund window</h2><p className="mt-2">Users may request a refund within 7 days of payment only if no substantial usage has occurred.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Non-refundable usage</h2><p className="mt-2">Refunds are not available after resume generation or download, ATS report generation, cover-letter generation, active use of paid features, or other substantial product usage.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Subscription cancellation</h2><p className="mt-2">Users may cancel a subscription to stop future billing. Cancellation does not automatically refund previous charges unless the refund eligibility criteria above are met.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Processing timeline</h2><p className="mt-2">Approved refunds are processed to the original payment method according to Razorpay/payment gateway, bank, and card-network timelines.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Current billing status</h2><p className="mt-2">Paid checkout may be unavailable during beta or payment-provider review. Pricing and billing terms will be shown before purchase when payments are active.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Contact</h2><p className="mt-2">For cancellation or refund requests, email <a className="font-bold text-[#176b5b]" href="mailto:support@applywise.app">support@applywise.app</a> from your registered account email.</p></section>
    </PolicyLayout>
  );
}
