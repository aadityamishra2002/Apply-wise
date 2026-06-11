import Link from "next/link";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refund policy" },
  { href: "/shipping-policy", label: "Shipping policy" },
  { href: "/contact", label: "Contact" },
];

export function PublicFooter({ dark = false }: { dark?: boolean }) {
  return (
    <footer className={dark ? "bg-[#173b35] px-5 py-12 text-white" : "border-t border-[#e4e8e3] bg-white px-5 py-10 text-[#23312e]"}>
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 sm:flex-row sm:items-start">
        <div>
          <p className="text-[20px] font-bold tracking-[-0.05em]">Apply Wise</p>
          <p className={`mt-2 max-w-xl text-[12px] leading-5 ${dark ? "text-[#b8d3cd]" : "text-[#70807c]"}`}>
            Digital SaaS product for AI-assisted resume analysis, job matching, application drafts, and application tracking. AI-generated outputs should be reviewed before use.
          </p>
          <p className={`mt-2 text-[11px] leading-5 ${dark ? "text-[#b8d3cd]" : "text-[#70807c]"}`}>
            Not affiliated with LinkedIn, Naukri, Indeed, Workday, Ashby, SmartRecruiters, or other third-party job platforms.
          </p>
        </div>
        <div className={`flex max-w-lg flex-wrap gap-x-4 gap-y-2 text-[12px] font-bold ${dark ? "text-[#d6ebe6]" : "text-[#176b5b]"}`}>
          {footerLinks.map((link) => (
            <Link href={link.href} key={link.href}>{link.label}</Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
