import type { ReactNode } from "react";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { PublicFooter } from "@/components/public-footer";

type PolicyLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function PolicyLayout({ eyebrow, title, description, children }: PolicyLayoutProps) {
  return (
    <main className="min-h-screen bg-[#fbfcf9] text-[#23312e]">
      <header className="border-b border-[#e9ece8] bg-white/90">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-8">
          <Logo />
          <nav className="hidden items-center gap-5 text-[12px] font-bold text-[#65736f] sm:flex">
            <Link href="/about">About</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </div>
      </header>
      <section className="px-5 py-10 md:py-14">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#e4e8e3] bg-white p-6 small-shadow md:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#91a09c]">{eyebrow}</p>
          <h1 className="mt-3 text-[34px] font-bold tracking-[-0.06em]">{title}</h1>
          <p className="mt-4 text-[13px] leading-6 text-[#65736f]">{description}</p>
          <div className="mt-8 space-y-6 text-[13px] leading-6 text-[#53645f]">{children}</div>
          <Link className="mt-8 inline-flex rounded-full bg-[#176b5b] px-5 py-3 text-[13px] font-bold text-white" href="/">Back home</Link>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
