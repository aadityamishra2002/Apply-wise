import Link from "next/link";
import { ArrowRight, Bookmark, BriefcaseBusiness, CalendarCheck2, CircleCheckBig, FileText, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/ui";

const onboardingSteps = [
  {
    href: "/resume",
    icon: FileText,
    title: "Add your master resume",
    detail: "Resume upload and parsing are the next workflow being connected.",
  },
  {
    href: "/jobs",
    icon: Search,
    title: "Review job discovery",
    detail: "Live provider integrations will appear here after your profile is ready.",
  },
  {
    href: "/applications",
    icon: BriefcaseBusiness,
    title: "Track your applications",
    detail: "Your application board starts empty and will only contain roles you save.",
  },
];

export default function DashboardPage() {
  return (
    <AppShell
      eyebrow="Workspace overview"
      title="Welcome to your workspace"
      actions={<Link className="hidden rounded-lg bg-[#176b5b] px-3.5 py-2 text-[12px] font-bold text-white sm:block" href="/resume">Add resume</Link>}
    >
      <section className="rounded-2xl border border-[#dce7e2] bg-gradient-to-r from-[#eaf6f2] to-[#f4f8dc] p-5 md:flex md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#176b5b]">Start here</p>
          <h2 className="mt-1.5 text-[22px] font-bold tracking-[-0.05em]">Build your profile before reviewing matches.</h2>
          <p className="mt-2 text-[13px] text-[#65736f]">Your workspace is empty until you add real resume evidence and start saving opportunities.</p>
        </div>
        <Link className="mt-4 flex w-fit items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white md:mt-0" href="/resume">
          Add your resume <ArrowRight size={15} />
        </Link>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<BriefcaseBusiness size={18} />} label="Applications" value="0" detail="No activity yet" />
        <StatCard icon={<CalendarCheck2 size={18} />} label="Interviews" value="0" detail="No activity yet" tone="lime" />
        <StatCard icon={<Bookmark size={18} />} label="Saved roles" value="0" detail="No saved roles" tone="amber" />
        <StatCard icon={<CircleCheckBig size={18} />} label="Avg. match" value="--" detail="Add a resume first" tone="blue" />
      </section>

      <section className="mt-6 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
        <div>
          <h2 className="text-[16px] font-bold tracking-[-0.03em]">Set up your workspace</h2>
          <p className="mt-1 text-[12px] text-[#8b9895]">Your account is ready. These are the next steps for building your real application history.</p>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {onboardingSteps.map((step) => {
            const Icon = step.icon;
            return (
              <Link className="rounded-2xl border border-[#e4e8e3] bg-[#fbfcfa] p-4 transition hover:border-[#b9d4cd]" href={step.href} key={step.href}>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f4ef] text-[#176b5b]"><Icon size={17} /></div>
                <h3 className="mt-4 text-[13px] font-bold">{step.title}</h3>
                <p className="mt-2 text-[12px] leading-5 text-[#71807c]">{step.detail}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.28fr_.72fr]">
        <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <h2 className="text-[16px] font-bold tracking-[-0.03em]">Recommended jobs</h2>
          <p className="mt-1 text-[12px] text-[#8b9895]">Ranked recommendations will appear after live job discovery and resume parsing are connected.</p>
          <div className="mt-5 rounded-xl border border-dashed border-[#d5dedb] bg-[#fbfcfa] p-8 text-center">
            <Search className="mx-auto text-[#91a09c]" size={21} />
            <p className="mt-3 text-[13px] font-bold">No recommendations yet</p>
            <p className="mt-1 text-[12px] text-[#8b9895]">Your workspace will only show jobs evaluated against your real profile.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <h2 className="text-[16px] font-bold tracking-[-0.03em]">Application activity</h2>
          <p className="mt-1 text-[12px] text-[#8b9895]">Your past 7 days</p>
          <div className="mt-7 flex h-[138px] items-end gap-3">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <div className="flex h-full flex-1 flex-col justify-end gap-2" key={`${day}-${index}`}>
                <div className="h-1 rounded-t-md bg-[#e4ebe8]" />
                <span className="text-center text-[10px] font-bold text-[#a0aba8]">{day}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
        <h2 className="text-[16px] font-bold tracking-[-0.03em]">Recent applications</h2>
        <p className="mt-1 text-[12px] text-[#8b9895]">Applications you save and track will appear here.</p>
        <div className="mt-5 rounded-xl border border-dashed border-[#d5dedb] bg-[#fbfcfa] p-8 text-center">
          <BriefcaseBusiness className="mx-auto text-[#91a09c]" size={21} />
          <p className="mt-3 text-[13px] font-bold">No applications yet</p>
          <p className="mt-1 text-[12px] text-[#8b9895]">Your pipeline starts clean.</p>
        </div>
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}
