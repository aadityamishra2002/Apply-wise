import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  return <AppShell eyebrow="Workspace preferences" title="Settings"><div className="rounded-2xl border border-[#e4e8e3] bg-white p-8 small-shadow"><h2 className="text-[18px] font-bold">Settings foundation is ready.</h2><p className="mt-2 text-[13px] text-[#71807c]">Account security, AI consent, and job preferences will be configured here.</p></div></AppShell>;
}

