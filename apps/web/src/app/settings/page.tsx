"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getAccessToken, loadJobPreferences, saveJobPreferences, type JobPreferences } from "@/lib/api";

const emptyPreferences: JobPreferences = { role_keywords: "", location: "", remote_only: false };

export default function SettingsPage() {
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const token = getAccessToken(); if (token) void loadJobPreferences(token).then(setPreferences).catch((loadError: Error) => setError(loadError.message)).finally(() => setLoading(false)); }, []);
  async function persist() {
    const token = getAccessToken(); if (!token) return;
    setSaving(true); setSaved(false); setError(null);
    try { setPreferences(await saveJobPreferences(preferences, token)); setSaved(true); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save job preferences."); }
    finally { setSaving(false); }
  }
  return <AppShell eyebrow="Workspace preferences" title="Settings">
    <section className="max-w-2xl rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
      <h2 className="text-[18px] font-bold">Job discovery preferences</h2><p className="mt-2 text-[13px] leading-6 text-[#71807c]">These defaults shape your recommended jobs whenever you open discovery without entering a search.</p>
      {loading ? <div className="grid min-h-[220px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin"/></div> : <div className="mt-5 space-y-4">
        <label className="block text-[12px] font-bold text-[#53645f]">Role keywords<input className="mt-2 w-full rounded-xl border border-[#dce7e2] px-3 py-3 text-[13px] font-normal outline-none focus:border-[#79b6a8]" onChange={(event) => setPreferences({...preferences,role_keywords:event.target.value})} placeholder="Python developer, product engineer" value={preferences.role_keywords}/></label>
        <label className="block text-[12px] font-bold text-[#53645f]">Preferred location<input className="mt-2 w-full rounded-xl border border-[#dce7e2] px-3 py-3 text-[13px] font-normal outline-none focus:border-[#79b6a8]" onChange={(event) => setPreferences({...preferences,location:event.target.value})} placeholder="Bengaluru, Mumbai, Remote" value={preferences.location}/></label>
        <label className="flex items-center gap-2 text-[12px] font-bold text-[#53645f]"><input checked={preferences.remote_only} onChange={(event) => setPreferences({...preferences,remote_only:event.target.checked})} type="checkbox"/>Only show roles that mention remote work</label>
        {error ? <p className="rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{error}</p> : null}
        <div className="flex items-center gap-3"><button className="flex items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white disabled:opacity-60" disabled={saving} onClick={() => void persist()}><Save size={14}/>{saving ? "Saving..." : "Save preferences"}</button>{saved ? <p className="flex items-center gap-1 text-[12px] font-bold text-[#66801f]"><Check size={14}/>Saved</p> : null}</div>
      </div>}
    </section>
  </AppShell>;
}
