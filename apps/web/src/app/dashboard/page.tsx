import Link from "next/link";
import { ArrowRight, Bookmark, BriefcaseBusiness, CalendarCheck2, CircleCheckBig, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MatchRing, Pill, StatCard } from "@/components/ui";
import { applications, jobs } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <AppShell
      eyebrow="Sunday, May 31"
      title="Good morning, Avery"
      actions={<Link className="hidden rounded-lg bg-[#176b5b] px-3.5 py-2 text-[12px] font-bold text-white sm:block" href="/jobs">Discover jobs</Link>}
    >
      <section className="rounded-2xl border border-[#dce7e2] bg-gradient-to-r from-[#eaf6f2] to-[#f4f8dc] p-5 md:flex md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#176b5b]">Weekly focus</p>
          <h2 className="mt-1.5 text-[22px] font-bold tracking-[-0.05em]">You have 12 new high-fit roles to review.</h2>
          <p className="mt-2 text-[13px] text-[#65736f]">A few thoughtful applications today could make this your strongest week yet.</p>
        </div>
        <Link className="mt-4 flex w-fit items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white md:mt-0" href="/jobs">
          Review matches <ArrowRight size={15} />
        </Link>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<BriefcaseBusiness size={18} />} label="Applications" value="24" detail="+6 this week" />
        <StatCard icon={<CalendarCheck2 size={18} />} label="Interviews" value="6" detail="25% rate" tone="lime" />
        <StatCard icon={<Bookmark size={18} />} label="Saved roles" value="18" detail="12 new" tone="amber" />
        <StatCard icon={<CircleCheckBig size={18} />} label="Avg. match" value="82%" detail="+4% vs last week" tone="blue" />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.28fr_.72fr]">
        <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-bold tracking-[-0.03em]">Recommended jobs</h2>
              <p className="mt-1 text-[12px] text-[#8b9895]">Ranked against your verified resume</p>
            </div>
            <Link className="text-[12px] font-bold text-[#176b5b]" href="/jobs">View all</Link>
          </div>
          <div className="mt-4 divide-y divide-[#edf0ed]">
            {jobs.slice(0, 3).map((job) => (
              <div className="flex items-center gap-3 py-4" key={job.id}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1c2926] text-[13px] font-bold text-white">{job.initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{job.title}</p>
                  <p className="mt-1 truncate text-[11px] text-[#8b9895]">{job.company} · {job.location} · {job.posted}</p>
                </div>
                <div className="hidden gap-1.5 md:flex">
                  {job.matching.slice(0, 2).map((skill) => <Pill tone="green" key={skill}>{skill}</Pill>)}
                </div>
                <MatchRing score={job.match} small />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <h2 className="text-[16px] font-bold tracking-[-0.03em]">Application activity</h2>
          <p className="mt-1 text-[12px] text-[#8b9895]">Your past 7 days</p>
          <div className="mt-7 flex h-[138px] items-end gap-3">
            {[38, 67, 34, 82, 52, 100, 58].map((height, index) => (
              <div className="flex h-full flex-1 flex-col justify-end gap-2" key={index}>
                <div className="rounded-t-md bg-[#b9dcd2]" style={{ height: `${height}%` }} />
                <span className="text-center text-[10px] font-bold text-[#a0aba8]">{["M", "T", "W", "T", "F", "S", "S"][index]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold tracking-[-0.03em]">Recent applications</h2>
            <p className="mt-1 text-[12px] text-[#8b9895]">Your latest application progress</p>
          </div>
          <Link className="text-[12px] font-bold text-[#176b5b]" href="/applications">Open tracker</Link>
        </div>
        <div className="mt-4 overflow-x-auto thin-scrollbar">
          <table className="w-full min-w-[650px] text-left">
            <thead><tr className="border-b border-[#edf0ed] text-[10px] uppercase tracking-[0.12em] text-[#a0aba8]"><th className="pb-3 font-bold">Company</th><th className="pb-3 font-bold">Role</th><th className="pb-3 font-bold">Match</th><th className="pb-3 font-bold">Status</th><th className="pb-3 font-bold">Updated</th></tr></thead>
            <tbody>
              {applications.map((application) => (
                <tr className="border-b border-[#f1f3f1] text-[12px]" key={`${application.company}-${application.title}`}>
                  <td className="py-3.5 font-bold">{application.company}</td>
                  <td className="py-3.5 text-[#65736f]">{application.title}</td>
                  <td className="py-3.5 font-bold text-[#176b5b]">{application.match}%</td>
                  <td className="py-3.5"><Pill tone={application.status === "Interview" ? "lime" : application.status === "Saved" ? "amber" : "green"}>{application.status}</Pill></td>
                  <td className="py-3.5 text-[#8b9895]">{application.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}

