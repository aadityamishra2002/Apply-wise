"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CloudUpload, Download, FileText, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/ui";
import { downloadResumeVersion, getAccessToken, loadResumeProfile, loadResumeVersions, uploadResume, type ResumeProfile, type ResumeVersionRecord } from "@/lib/api";

export default function ResumePage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<ResumeVersionRecord[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    void loadResumeProfile(token)
      .then(setProfile)
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
    void loadResumeVersions(token).then(setVersions).catch((loadError: Error) => setError(loadError.message));
  }, []);

  async function handleFile(file: File | undefined) {
    const token = getAccessToken();
    if (!file || !token) return;
    setUploading(true);
    setError(null);
    try {
      setProfile(await uploadResume(file, token));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Resume upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function download(versionId: string, format: "docx" | "pdf") {
    const token = getAccessToken();
    if (token) void downloadResumeVersion(versionId, format, token).catch((downloadError: Error) => setError(downloadError.message));
  }

  return (
    <AppShell eyebrow="Profile foundation" title="My resume">
      <section className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Master resume</p>
            <input
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              ref={fileInput}
              type="file"
            />
            <button
              className="mt-4 w-full rounded-2xl border border-dashed border-[#b8d4cc] bg-[#f6fbf9] p-6 text-center disabled:cursor-wait disabled:opacity-70"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              type="button"
            >
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e2f2ec] text-[#176b5b]">
                {uploading ? <LoaderCircle className="animate-spin" size={20} /> : <CloudUpload size={20} />}
              </div>
              <p className="mt-4 text-[13px] font-bold">{uploading ? "Extracting your resume..." : profile ? "Replace your master resume" : "Upload your master resume"}</p>
              <p className="mt-1 text-[11px] leading-5 text-[#91a09c]">PDF or DOCX, up to 10 MB. Text is extracted and stored securely in your profile.</p>
            </button>
            {error ? <p className="mt-3 rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{error}</p> : null}
          </div>

          {profile ? (
            <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
              <div className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f4ef] text-[#176b5b]"><FileText size={18} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold">{profile.original_filename}</p>
                  <p className="mt-1 text-[11px] text-[#91a09c]">Active master resume</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#f3f8e6] p-3 text-[11px] font-bold text-[#66801f]"><Check size={14} /> Extracted and ready for review</div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[#dce7e2] bg-gradient-to-br from-[#e8f4ef] to-[#f5f9e7] p-5">
            <ShieldCheck className="text-[#176b5b]" size={21} />
            <p className="mt-3 text-[14px] font-bold">Truthful tailoring, always.</p>
            <p className="mt-2 text-[12px] leading-5 text-[#65736f]">applywise only uses evidence extracted from your resume. It never invents skills, projects, or impact.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <h2 className="text-[17px] font-bold tracking-[-0.04em]">Extracted profile</h2>
          <p className="mt-1 text-[12px] text-[#91a09c]">Review the evidence your copilot will use for matching and tailoring.</p>

          {loading ? (
            <div className="grid min-h-[260px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" size={22} /></div>
          ) : profile ? (
            <>
              <div className="mt-6 border-t border-[#edf0ed] pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Detected sections</h3>
                <div className="mt-3 flex flex-wrap gap-2">{profile.detected_sections.map((section) => <Pill key={section} tone="lime">{section}</Pill>)}</div>
              </div>
              <div className="mt-6 border-t border-[#edf0ed] pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Skills</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.skills.length ? profile.skills.map((skill) => <Pill key={skill} tone="green">{skill}</Pill>) : <p className="text-[12px] text-[#91a09c]">No known skills detected yet.</p>}
                </div>
              </div>
              <div className="mt-6 border-t border-[#edf0ed] pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Extracted text preview</h3>
                <pre className="mt-3 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-xl bg-[#f6f8f5] p-4 text-[11px] leading-5 text-[#65736f] thin-scrollbar">{profile.extracted_text}</pre>
              </div>
              <div className="mt-6 border-t border-[#edf0ed] pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Experience</h3>
                <div className="mt-3 space-y-3">
                  {profile.experiences.length ? profile.experiences.map((experience) => (
                    <div className="rounded-xl bg-[#f6f8f5] p-4" key={`${experience.title}-${experience.company}`}>
                      <p className="text-[13px] font-bold">{experience.title}</p>
                      <p className="mt-1 text-[12px] font-bold text-[#176b5b]">{experience.company}</p>
                      <p className="mt-2 text-[12px] leading-5 text-[#71807c]">{experience.description}</p>
                    </div>
                  )) : <p className="text-[12px] text-[#91a09c]">No structured experience blocks detected yet.</p>}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-[#d5dedb] bg-[#fbfcfa] p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f4ef] text-[#176b5b]"><FileText size={21} /></div>
              <h3 className="mt-4 text-[15px] font-bold">No resume profile yet</h3>
              <p className="mx-auto mt-2 max-w-lg text-[12px] leading-5 text-[#71807c]">Upload your resume to extract its sections and recognized skills.</p>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#f6f8f5] p-4">
            <Sparkles size={17} className="mt-0.5 shrink-0 text-[#176b5b]" />
            <p className="text-[12px] leading-5 text-[#65736f]">Your extracted evidence powers explainable matching and truthful application drafts. Review it whenever you replace your master resume.</p>
          </div>
        </div>
      </section>
      <section className="mt-5 rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
        <h2 className="text-[17px] font-bold tracking-[-0.04em]">Tailored resume versions</h2>
        <p className="mt-1 text-[12px] text-[#91a09c]">Every prepared application creates an auditable draft tied to its source resume.</p>
        {versions.length ? <div className="mt-4 space-y-3">{versions.map((version) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#edf0ed] p-4" key={version.id}><div><p className="text-[13px] font-bold">{version.job_title}</p><p className="mt-1 text-[12px] text-[#71807c]">{version.company}</p></div><div className="flex items-center gap-2"><button className="flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => download(version.id, "docx")}><Download size={13}/>DOCX</button><button className="flex items-center gap-1 rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b]" onClick={() => download(version.id, "pdf")}><Download size={13}/>PDF</button><Pill tone="green">Draft saved</Pill></div></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-[#d5dedb] p-5 text-center text-[12px] text-[#91a09c]">No tailored versions yet. Prepare a saved application to create one.</p>}
      </section>
      <div className="h-16 lg:hidden" />
    </AppShell>
  );
}
