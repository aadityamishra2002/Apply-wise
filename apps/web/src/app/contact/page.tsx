import { PolicyLayout } from "@/components/policy-layout";

export default function ContactPage() {
  return (
    <PolicyLayout
      eyebrow="Contact"
      title="Contact Apply Wise"
      description="For support, privacy, billing, refund, or product questions, use the contact details below. A contact form will be added later."
    >
      {/* TODO: Replace placeholder business/founder details before final payment gateway review. */}
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Support email</h2><p className="mt-2"><a className="font-bold text-[#176b5b]" href="mailto:support@applywise.app">support@applywise.app</a></p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Business/founder name</h2><p className="mt-2">TODO: Replace with legal business name or founder name.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Location</h2><p className="mt-2">India</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Response time</h2><p className="mt-2">We aim to respond within 24-48 business hours.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Reviewer note</h2><p className="mt-2">Apply Wise is a digital SaaS product for AI-assisted resume analysis, ATS scoring, job matching, resume tailoring, cover-letter drafting, and application tracking. The product uses assisted workflows and requires manual review before job submission.</p></section>
    </PolicyLayout>
  );
}
