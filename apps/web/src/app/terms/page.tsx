import { PolicyLayout } from "@/components/policy-layout";

export default function TermsPage() {
  return (
    <PolicyLayout
      eyebrow="Terms and Conditions"
      title="Apply Wise Terms"
      description="Last updated June 11, 2026. These terms describe responsible use of Apply Wise, an AI-assisted job application SaaS product."
    >
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Service description</h2><p className="mt-2">Apply Wise provides AI-assisted resume parsing, ATS-readiness analysis, job matching, resume tailoring, cover-letter generation, and application tracking tools. The product supports an assisted application workflow with manual review before submission.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">No employment guarantee</h2><p className="mt-2">Apply Wise does not guarantee interviews, job offers, hiring outcomes, employer responses, ATS acceptance, or application success. Job decisions remain with employers and third-party platforms.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">User responsibility</h2><p className="mt-2">Users are responsible for verifying every generated resume, cover letter, ATS report, job match, and application field before use. AI-generated outputs may contain mistakes and should be reviewed before submission.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Truthful and acceptable use</h2><p className="mt-2">Users must not use Apply Wise for spam, fraud, fake profiles, fabricated work history, misleading qualifications, mass unsolicited applications, or activities that violate laws or third-party job platform terms.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Third-party platforms</h2><p className="mt-2">Apply Wise is not affiliated with LinkedIn, Naukri, Indeed, Workday, Ashby, SmartRecruiters, Greenhouse, Lever, or other job boards, employers, or applicant tracking systems. Users must follow the terms of any third-party site they use.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Business details</h2><p className="mt-2">Founder/business name: Aaditya Mishra. Location: India.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Contact</h2><p className="mt-2">For terms or support questions, contact <a className="font-bold text-[#176b5b]" href="mailto:support@applywise.app">support@applywise.app</a>.</p></section>
    </PolicyLayout>
  );
}
