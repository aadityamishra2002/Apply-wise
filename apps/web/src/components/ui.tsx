import type { ReactNode } from "react";

export function Pill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "green" | "amber" | "lime";
}) {
  const tones = {
    default: "border-[#e4e8e3] bg-white text-[#65736f]",
    green: "border-[#cde5de] bg-[#eaf7f2] text-[#176b5b]",
    amber: "border-[#f5dfae] bg-[#fff8e6] text-[#8a6110]",
    lime: "border-[#d9e8b5] bg-[#f4f9e6] text-[#587018]",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function MatchRing({ score, small = false }: { score: number; small?: boolean }) {
  const size = small ? "h-11 w-11" : "h-16 w-16";
  const inner = small ? "h-8 w-8 text-[11px]" : "h-[50px] w-[50px] text-[15px]";
  return (
    <div
      className={`grid ${size} place-items-center rounded-full`}
      style={{ background: `conic-gradient(#176b5b ${score * 3.6}deg, #e2ebe7 0deg)` }}
    >
      <div className={`grid ${inner} place-items-center rounded-full bg-white font-bold text-[#176b5b]`}>
        {score}%
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "green" | "lime" | "amber" | "blue";
}) {
  const tones = {
    green: "bg-[#e6f4ef] text-[#176b5b]",
    lime: "bg-[#f0f7dc] text-[#66801f]",
    amber: "bg-[#fff5da] text-[#a06b08]",
    blue: "bg-[#e9f0f7] text-[#46718c]",
  };
  return (
    <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
      <div className="mb-4 flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span>
        <span className="text-[11px] font-bold text-[#8b9895]">{detail}</span>
      </div>
      <p className="text-[12px] font-bold uppercase tracking-[0.11em] text-[#8b9895]">{label}</p>
      <p className="mt-1 text-[30px] font-bold tracking-[-0.06em] text-[#172321]">{value}</p>
    </div>
  );
}

