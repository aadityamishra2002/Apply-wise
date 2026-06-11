import { PolicyLayout } from "@/components/policy-layout";

export default function AboutPage() {
  return (
    <PolicyLayout
      eyebrow="About Apply Wise"
      title="A Safer, More Organized Job Application Assistant"
      description="Apply Wise helps job seekers understand role fit, prepare truthful application drafts, and track applications in one workspace."
    >
      {/* TODO: Replace founder/business placeholder with final legal identity. */}
      <section><h2 className="text-[17px] font-bold text-[#23312e]">What we do</h2><p className="mt-2">Apply Wise is an AI-powered job application assistant for resume parsing, ATS scoring, job matching, resume tailoring, cover-letter generation, and application tracking.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">How we work</h2><p className="mt-2">The product is designed around assisted workflows. Users review generated outputs before use, and final job submission remains manual unless explicitly changed after testing and consent.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Business details</h2><p className="mt-2">Founder/business name: TODO: replace with legal business or founder name. Location: India. Support: <a className="font-bold text-[#176b5b]" href="mailto:support@applywise.app">support@applywise.app</a>.</p></section>
      <section><h2 className="text-[17px] font-bold text-[#23312e]">Important disclaimer</h2><p className="mt-2">Apply Wise is not affiliated with LinkedIn, Naukri, Indeed, Workday, Ashby, SmartRecruiters, Greenhouse, Lever, or other job platforms. AI-generated outputs should be reviewed before use.</p></section>
    </PolicyLayout>
  );
}
