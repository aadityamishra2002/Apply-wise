"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  FileText,
  LayoutDashboard,
  LogOut,
  Shield,
  Search,
  Settings,
} from "lucide-react";

import { AuthGuard } from "@/components/auth-guard";
import { Logo } from "@/components/logo";
import { PublicFooter } from "@/components/public-footer";
import { logout, type CurrentUser } from "@/lib/api";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/jobs", label: "Discover jobs", icon: Search },
  { href: "/resume", label: "My resume", icon: FileText },
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

type AppShellProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function AppShell(props: AppShellProps) {
  return <AuthGuard>{(user) => <AuthenticatedShell {...props} user={user} />}</AuthGuard>;
}

function AuthenticatedShell({
  title,
  eyebrow,
  children,
  actions,
  user,
}: AppShellProps & { user: CurrentUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = user.email.slice(0, 2).toUpperCase();

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-[#f8f9f6]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[226px] border-r border-[#e4e8e3] bg-white px-3 py-5 lg:block">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-9 space-y-1">
          {[...items, ...(user.role === "admin" ? [{ href: "/admin", label: "Admin", icon: Shield }] : [])].map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition ${
                  active ? "bg-[#e8f4ef] text-[#176b5b]" : "text-[#70807c] hover:bg-[#f6f8f5] hover:text-[#33433f]"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon size={17} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-3 bottom-4">
          <Link
            className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-[#70807c] hover:bg-[#f6f8f5]"
            href="/settings"
          >
            <Settings size={17} />
            Settings
          </Link>
          <div className="flex items-center gap-3 border-t border-[#edf0ed] px-2 pt-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#dcefe9] text-[12px] font-bold text-[#176b5b]">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold">{user.email}</p>
              <p className="truncate text-[11px] text-[#8b9895]">{user.role === "admin" ? "Owner workspace" : "Active workspace"}</p>
            </div>
            <button aria-label="Log out" className="text-[#8b9895] hover:text-[#176b5b]" onClick={signOut} title="Log out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <main className="lg:pl-[226px]">
        <header className="sticky top-0 z-10 flex h-[70px] items-center justify-between border-b border-[#e4e8e3] bg-white/90 px-5 backdrop-blur md:px-8">
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <div className="hidden lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#91a09c]">{eyebrow}</p>
            <h1 className="text-[19px] font-bold tracking-[-0.04em]">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button className="grid h-9 w-9 place-items-center rounded-full border border-[#e4e8e3] bg-white text-[#70807c]">
              <Bell size={16} />
            </button>
          </div>
        </header>
        <div className="mx-auto max-w-[1450px] p-5 md:p-8">{children}</div>
        <div className="pb-20 lg:pb-0">
          <PublicFooter />
        </div>
      </main>
      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border border-[#e4e8e3] bg-white/95 p-2 shadow-lg backdrop-blur lg:hidden">
        {items.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link className={`grid place-items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-bold ${active ? "text-[#176b5b]" : "text-[#8b9895]"}`} href={item.href} key={item.href}>
              <Icon size={16} />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
