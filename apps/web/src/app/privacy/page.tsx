import { PolicyLayout } from "@/components/policy-layout";

export default function PrivacyPage() {
  return (
    <PolicyLayout
      eyebrow="Privacy Policy"
      title="How Apply Wise Handles Resume and Job Data"
      description="Last updated June 11, 2026. This policy explains what data Apply Wise collects and how it is used to provide the SaaS product."
    >
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Data we collect</h2><p className="mt-2">Apply Wise may collect name, email address, account details, uploaded resumes, extracted resume text, skills, experience, education, certifications, job descriptions, saved jobs, generated resumes, generated cover letters, ATS reports, application statuses, notes, interview records, usage data, and payment metadata.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">How data is used</h2><p className="mt-2">We use this data for ATS scoring, resume tailoring, cover-letter drafting, job matching, application tracking, account management, support, abuse prevention, product analytics, and improving user experience.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">AI processing</h2><p className="mt-2">When AI features are enabled, relevant resume and job-description content may be processed by configured AI providers to generate application drafts. Users should review all AI-generated outputs before use.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Payments</h2><p className="mt-2">Payment processing is handled by Razorpay or another payment gateway. Apply Wise does not store card numbers, CVV, UPI PINs, or full payment credentials. We may store limited payment metadata such as plan, status, transaction reference, and subscription status for account management.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Data deletion</h2><p className="mt-2">Users may request deletion of their account and associated resume/job data by contacting support. Some records may be retained where required for security, legal, tax, or dispute-resolution purposes.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Security</h2><p className="mt-2">Passwords are hashed, authenticated areas require tokens, and production secrets are kept outside the repository. No online service can guarantee absolute security, but Apply Wise is designed to protect user data responsibly.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Contact</h2><p className="mt-2">For privacy or deletion requests, email <a className="font-bold text-[#176b5b]" href="mailto:support@applywise.app">support@applywise.app</a>.</p></section>
    </PolicyLayout>
  );
}
