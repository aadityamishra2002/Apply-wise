import Link from "next/link";

import { PolicyLayout } from "@/components/policy-layout";

const plans = [
  {
    name: "Free",
    price: "₹0",
    cycle: "Free beta access",
    features: ["Resume upload and parsing", "Basic ATS insights", "Application tracker", "Manual job capture"],
  },
  {
    name: "Pro",
    price: "₹499",
    cycle: "per month",
    features: ["Everything in Free", "More resume tailoring credits", "Cover-letter drafts", "Review-before-apply workflow", "Priority feature access"],
  },
  {
    name: "Power User",
    price: "₹999",
    cycle: "per month",
    features: ["Everything in Pro", "Higher monthly usage limits", "Advanced application tracking", "Extension-assisted workflow", "Priority support"],
  },
];

export default function PricingPage() {
  return (
    <PolicyLayout
      eyebrow="Pricing"
      title="Simple INR Pricing for a Digital SaaS Product"
      description="Pricing is shown for payment gateway review and planned paid launch. Checkout may remain disabled until payment-provider approval is complete."
    >
      {/* TODO: Confirm final INR prices, billing cycle, taxes, and business registration details before enabling live checkout. */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <section className="rounded-2xl border border-[#e4e8e3] bg-[#fbfcf9] p-5" key={plan.name}>
            <h2 className="text-[18px] font-bold text-[#23312e]">{plan.name}</h2>
            <p className="mt-3 text-[34px] font-bold tracking-[-0.07em] text-[#176b5b]">{plan.price}</p>
            <p className="mt-1 text-[12px] font-bold text-[#70807c]">{plan.cycle}</p>
            <ul className="mt-5 space-y-2 text-[12px] leading-5 text-[#53645f]">
              {plan.features.map((feature) => <li key={feature}>- {feature}</li>)}
            </ul>
          </section>
        ))}
      </div>
      <section className="rounded-2xl bg-[#e8f4ef] p-5">
        <h2 className="text-[17px] font-bold text-[#23312e]">Billing and refund note</h2>
        <p className="mt-2">Paid plans are billed monthly in INR when checkout is enabled. Users may request a refund within 7 days only if no substantial usage has occurred. No refund is available after resume generation/download, ATS report generation, or active usage of paid features.</p>
      </section>
      <section className="rounded-2xl bg-[#f6f8f5] p-5">
        <h2 className="text-[17px] font-bold text-[#23312e]">Secure payments powered by Razorpay</h2>
        <p className="mt-2">When payments are enabled, payment details are processed by Razorpay/payment gateway. Apply Wise does not store card details, CVV, UPI PINs, or full payment credentials.</p>
      </section>
      <Link className="inline-flex rounded-full bg-[#176b5b] px-5 py-3 text-[13px] font-bold text-white" href="/register">Start with Free plan</Link>
    </PolicyLayout>
  );
}
