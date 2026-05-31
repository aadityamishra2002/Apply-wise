import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="flex items-center gap-2.5" href="/">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#176b5b] text-white shadow-sm">
        <Sparkles size={17} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="text-[17px] font-bold tracking-[-0.04em] text-[#172321]">
          apply<span className="text-[#176b5b]">wise</span>
        </span>
      )}
    </Link>
  );
}

