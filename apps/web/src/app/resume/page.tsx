"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, CloudUpload, Download, FileText, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/ui";
import { downloadResumeVersion, getAccessToken, loadResumeProfile, loadResumeVersions, reparseResume, saveResumeProfile, uploadResume, type ResumeProfile, type ResumeVersionRecord } from "@/lib/api";

export default function ResumePage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ResumeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editor, setEditor] = useState({
    skills: "",
    experiences: "",
    education: "",
    certifications: "",
    projects: "",
  });
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

  async function reparse() {
    const token = getAccessToken();
    if (!token) return;
    setReparsing(true);
    setError(null);
    try {
      setProfile(await reparseResume(token));
    } catch (reparseError) {
      setError(reparseError instanceof Error ? reparseError.message : "Resume re-parse failed.");
    } finally {
      setReparsing(false);
    }
  }

  function startEditingProfile() {
    if (!profile) return;
    setEditor({
      skills: profile.skills.join(", "),
      experiences: profile.experiences.map((item) => `${item.title} | ${item.company} | ${item.description}`).join("\n"),
      education: profile.education.map((item) => `${item.institution} | ${item.degree} | ${item.year ?? ""}`).join("\n"),
      certifications: profile.certifications.map((item) => `${item.name} | ${item.issuer ?? ""} | ${item.year ?? ""}`).join("\n"),
      projects: profile.projects.map((item) => `${item.name} | ${item.description} | ${item.technologies.join(", ")}`).join("\n"),
    });
    setEditingProfile(true);
  }

  async function saveStructuredProfile() {
    const token = getAccessToken();
    if (!token || !profile) return;
    setSavingProfile(true);
    setError(null);
    try {
      const updatedProfile: ResumeProfile = {
        ...profile,
        skills: splitList(editor.skills),
        experiences: splitRows(editor.experiences).map(([title, company, description]) => ({ title, company, description: description ?? "" })).filter((item) => item.title && item.company),
        education: splitRows(editor.education).map(([institution, degree, year]) => ({ institution, degree, year: year || null })).filter((item) => item.institution && item.degree),
        certifications: splitRows(editor.certifications).map(([name, issuer, year]) => ({ name, issuer: issuer || null, year: year || null })).filter((item) => item.name),
        projects: splitRows(editor.projects).map(([name, description, technologies]) => ({ name, description, technologies: splitList(technologies ?? "") })).filter((item) => item.name && item.description),
      };
      setProfile(await saveResumeProfile(updatedProfile, token));
      setEditingProfile(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save resume profile.");
    } finally {
      setSavingProfile(false);
    }
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
              <button
                className="mt-3 w-full rounded-xl bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b] disabled:cursor-wait disabled:opacity-70"
                disabled={reparsing}
                onClick={() => void reparse()}
                type="button"
              >
                {reparsing ? "Re-parsing..." : "Re-parse extracted profile"}
              </button>
            </div>
          ) : null}

          {profile ? (
            <div className="rounded-2xl border border-[#dce7e2] bg-white p-5 small-shadow">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Next steps</p>
              <h2 className="mt-3 text-[16px] font-bold">Turn this resume into applications</h2>
              <div className="mt-4 space-y-3 text-[12px] leading-5 text-[#65736f]">
                <p><span className="font-bold text-[#176b5b]">1.</span> Review resume-matched jobs and the 80+ ATS queue.</p>
                <p><span className="font-bold text-[#176b5b]">2.</span> Save a role, then prepare a tailored resume and cover letter.</p>
                <p><span className="font-bold text-[#176b5b]">3.</span> Open Review Application before using assisted autofill.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="rounded-lg bg-[#176b5b] px-3 py-2 text-[12px] font-bold text-white" href="/jobs">Review matches</Link>
                <Link className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b]" href="/applications">Open pipeline</Link>
              </div>
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
          {profile ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[12px] font-bold text-[#176b5b]" onClick={startEditingProfile} type="button">Edit structured profile</button>
              {editingProfile ? <button className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px] font-bold text-[#65736f]" onClick={() => setEditingProfile(false)} type="button">Cancel edit</button> : null}
            </div>
          ) : null}

          {loading ? (
            <div className="grid min-h-[260px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" size={22} /></div>
          ) : profile && editingProfile ? (
            <div className="mt-6 space-y-4 border-t border-[#edf0ed] pt-5">
              <EditorField label="Skills" help="Comma or newline separated." value={editor.skills} onChange={(value) => setEditor({ ...editor, skills: value })} />
              <EditorField label="Experience" help="One per line: title | company | description" value={editor.experiences} onChange={(value) => setEditor({ ...editor, experiences: value })} />
              <EditorField label="Education" help="One per line: institution | degree | year" value={editor.education} onChange={(value) => setEditor({ ...editor, education: value })} />
              <EditorField label="Certifications" help="One per line: name | issuer | year" value={editor.certifications} onChange={(value) => setEditor({ ...editor, certifications: value })} />
              <EditorField label="Projects" help="One per line: name | description | technologies" value={editor.projects} onChange={(value) => setEditor({ ...editor, projects: value })} />
              <button className="rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white disabled:cursor-wait disabled:opacity-70" disabled={savingProfile} onClick={() => void saveStructuredProfile()} type="button">
                {savingProfile ? "Saving profile..." : "Save structured profile"}
              </button>
            </div>
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
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Education</h3>
                <div className="mt-3 space-y-3">
                  {profile.education.length ? profile.education.map((education) => (
                    <div className="rounded-xl bg-[#f6f8f5] p-4" key={`${education.degree}-${education.institution}`}>
                      <p className="text-[13px] font-bold">{education.degree}</p>
                      <p className="mt-1 text-[12px] font-bold text-[#176b5b]">{education.institution}</p>
                      {education.year ? <p className="mt-2 text-[11px] text-[#71807c]">{education.year}</p> : null}
                    </div>
                  )) : <p className="text-[12px] text-[#91a09c]">No structured education blocks detected yet.</p>}
                </div>
              </div>
              <div className="mt-6 border-t border-[#edf0ed] pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Certifications</h3>
                <div className="mt-3 space-y-3">
                  {profile.certifications.length ? profile.certifications.map((certification) => (
                    <div className="rounded-xl bg-[#f6f8f5] p-4" key={`${certification.name}-${certification.issuer ?? "issuer"}`}>
                      <p className="text-[13px] font-bold">{certification.name}</p>
                      {certification.issuer ? <p className="mt-1 text-[12px] font-bold text-[#176b5b]">{certification.issuer}</p> : null}
                      {certification.year ? <p className="mt-2 text-[11px] text-[#71807c]">{certification.year}</p> : null}
                    </div>
                  )) : <p className="text-[12px] text-[#91a09c]">No structured certifications detected yet.</p>}
                </div>
              </div>
              <div className="mt-6 border-t border-[#edf0ed] pt-5">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">Projects</h3>
                <div className="mt-3 space-y-3">
                  {profile.projects.length ? profile.projects.map((project) => (
                    <div className="rounded-xl bg-[#f6f8f5] p-4" key={project.name}>
                      <p className="text-[13px] font-bold">{project.name}</p>
                      <p className="mt-2 text-[12px] leading-5 text-[#71807c]">{project.description}</p>
                      {project.technologies.length ? <div className="mt-3 flex flex-wrap gap-2">{project.technologies.map((technology) => <Pill key={`${project.name}-${technology}`} tone="green">{technology}</Pill>)}</div> : null}
                    </div>
                  )) : <p className="text-[12px] text-[#91a09c]">No structured projects detected yet.</p>}
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

function splitList(value: string): string[] {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

function splitRows(value: string): string[][] {
  return value.split("\n").map((line) => line.split("|").map((part) => part.trim())).filter((parts) => parts.some(Boolean));
}

function EditorField({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">{label}</span>
      <span className="mt-1 block text-[11px] text-[#91a09c]">{help}</span>
      <textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#dce7e2] bg-[#fbfcfa] p-3 text-[12px] leading-5 outline-none focus:border-[#85b7aa]" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}
