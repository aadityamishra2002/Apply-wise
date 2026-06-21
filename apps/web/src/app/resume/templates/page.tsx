"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, LoaderCircle, Pencil, Trash2, Upload } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/ui";
import {
  deleteResumeTemplate,
  getAccessToken,
  loadResumeTemplatePreview,
  loadResumeTemplates,
  renameResumeTemplate,
  selectResumeTemplate,
  uploadResumeTemplate,
  type ResumeTemplate,
  type ResumeTemplatePreview,
} from "@/lib/api";

export default function ResumeTemplatesPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [preview, setPreview] = useState<ResumeTemplatePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      setError("Log in again to manage resume templates.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loadedTemplates, loadedPreview] = await Promise.all([loadResumeTemplates(token), loadResumeTemplatePreview(token)]);
      setTemplates(loadedTemplates);
      setPreview(loadedPreview);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load resume templates.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadTemplate(file: File | undefined) {
    const token = getAccessToken();
    if (!file || !token) return;
    setBusy("upload");
    setError(null);
    setMessage(null);
    try {
      await uploadResumeTemplate(file, token);
      setMessage("Template uploaded and selected.");
      await refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Template upload failed.");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function selectTemplate(templateId: string) {
    const token = getAccessToken();
    if (!token) return;
    setBusy(`select-${templateId}`);
    setError(null);
    setMessage(null);
    try {
      await selectResumeTemplate(templateId, token);
      setMessage("Active resume template updated.");
      await refresh();
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Could not select template.");
    } finally {
      setBusy(null);
    }
  }

  async function renameTemplate(templateId: string) {
    const token = getAccessToken();
    const name = renameValue.trim();
    if (!token || !name) return;
    setBusy(`rename-${templateId}`);
    setError(null);
    setMessage(null);
    try {
      await renameResumeTemplate(templateId, name, token);
      setRenameId(null);
      setRenameValue("");
      setMessage("Template renamed.");
      await refresh();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Could not rename template.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteTemplate(templateId: string) {
    const token = getAccessToken();
    if (!token) return;
    if (!window.confirm("Delete this resume template? Existing generated resumes will fall back to the built-in ATS template.")) return;
    setBusy(`delete-${templateId}`);
    setError(null);
    setMessage(null);
    try {
      await deleteResumeTemplate(templateId, token);
      setMessage("Template deleted.");
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete template.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell eyebrow="Resume formatting" title="Resume templates" actions={<Link className="rounded-lg bg-[#e8f4ef] px-3.5 py-2 text-[12px] font-bold text-[#176b5b]" href="/resume">Back to resume</Link>}>
      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Upload DOCX template</p>
            <h2 className="mt-2 text-[18px] font-bold">Keep formatting consistent</h2>
            <p className="mt-2 text-[12px] leading-5 text-[#65736f]">Upload a DOCX resume with placeholders. Apply Wise replaces content only and keeps your fonts, margins, headings, spacing, bullet styles, and section order.</p>
            <div className="mt-4 rounded-xl bg-[#f6f8f5] p-4 text-[12px] leading-6 text-[#65736f]">
              Supported placeholders: <span className="font-bold text-[#176b5b]">{"{{NAME}}, {{CONTACT}}, {{SUMMARY}}, {{SKILLS}}, {{EXPERIENCE}}, {{PROJECTS}}, {{EDUCATION}}, {{CERTIFICATIONS}}"}</span>
            </div>
            <input accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => void uploadTemplate(event.target.files?.[0])} ref={fileInput} type="file" />
            <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3 text-[12px] font-bold text-white disabled:cursor-wait disabled:opacity-70" disabled={busy === "upload"} onClick={() => fileInput.current?.click()} type="button">
              {busy === "upload" ? <LoaderCircle className="animate-spin" size={15} /> : <Upload size={15} />} Upload DOCX template
            </button>
            {message ? <p className="mt-3 rounded-xl bg-[#f3f8e6] p-3 text-[12px] font-bold text-[#66801f]">{message}</p> : null}
            {error ? <p className="mt-3 rounded-xl bg-[#fff4ef] p-3 text-[12px] font-bold text-[#a34f3f]">{error}</p> : null}
          </div>

          <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Available templates</p>
            {loading ? <div className="grid min-h-[160px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" /></div> : (
              <div className="mt-4 space-y-3">
                {templates.map((template) => (
                  <div className="rounded-xl border border-[#edf0ed] p-4" key={template.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-bold">{template.name}</p>
                          {template.is_active ? <Pill tone="green">Active</Pill> : null}
                          {template.source === "built_in" ? <Pill tone="lime">Default</Pill> : null}
                        </div>
                        <p className="mt-1 text-[11px] text-[#91a09c]">{template.original_filename ?? "Built-in ATS-friendly one-page template"}</p>
                        <div className="mt-3 flex flex-wrap gap-2">{template.placeholders.map((placeholder) => <Pill key={`${template.id}-${placeholder}`}>{placeholder}</Pill>)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-lg bg-[#e8f4ef] px-3 py-2 text-[11px] font-bold text-[#176b5b] disabled:opacity-60" disabled={template.is_active || busy === `select-${template.id}`} onClick={() => void selectTemplate(template.id)} type="button">{busy === `select-${template.id}` ? "Selecting..." : "Select"}</button>
                        {template.source === "custom" ? <button className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[11px] font-bold text-[#65736f]" onClick={() => { setRenameId(template.id); setRenameValue(template.name); }} type="button"><Pencil size={12} /></button> : null}
                        {template.source === "custom" ? <button className="rounded-lg border border-[#f0c8bd] px-3 py-2 text-[11px] font-bold text-[#a34f3f] disabled:opacity-60" disabled={busy === `delete-${template.id}`} onClick={() => void deleteTemplate(template.id)} type="button"><Trash2 size={12} /></button> : null}
                      </div>
                    </div>
                    {renameId === template.id ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <input className="min-w-0 flex-1 rounded-lg border border-[#dce7e2] px-3 py-2 text-[12px]" onChange={(event) => setRenameValue(event.target.value)} value={renameValue} />
                        <button className="rounded-lg bg-[#176b5b] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-60" disabled={busy === `rename-${template.id}`} onClick={() => void renameTemplate(template.id)} type="button">Save</button>
                        <button className="rounded-lg border border-[#dce7e2] px-3 py-2 text-[11px] font-bold text-[#65736f]" onClick={() => setRenameId(null)} type="button">Cancel</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e4e8e3] bg-white p-5 small-shadow">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f4ef] text-[#176b5b]"><FileText size={18} /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#91a09c]">Active template preview</p>
              <h2 className="mt-1 text-[18px] font-bold">{preview?.template.name ?? "Loading template..."}</h2>
              <p className="mt-2 text-[12px] leading-5 text-[#65736f]">This preview shows how structured resume JSON maps into the selected template. DOCX export preserves template formatting; PDF export uses the same section order.</p>
            </div>
          </div>
          {preview ? (
            <>
              <div className="mt-5 rounded-xl bg-[#f6f8f5] p-4">
                <p className="text-[12px] font-bold text-[#176b5b]">Section order</p>
                <div className="mt-3 flex flex-wrap gap-2">{preview.section_order.map((section) => <Pill key={section} tone="green">{section}</Pill>)}</div>
                {preview.missing_placeholders.length ? <p className="mt-3 text-[11px] leading-5 text-[#71807c]">Missing placeholders are appended safely at export: {preview.missing_placeholders.join(", ")}.</p> : <p className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#66801f]"><Check size={13} /> All supported sections have placeholders.</p>}
              </div>
              <div className="mt-5 space-y-4">
                {Object.entries(preview.preview).map(([section, lines]) => (
                  <div className="rounded-xl border border-[#edf0ed] p-4" key={section}>
                    <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#71807c]">{section}</p>
                    {lines.length ? <div className="mt-2 space-y-1 text-[12px] leading-5 text-[#65736f]">{lines.map((line, index) => <p key={`${section}-${index}`}>{line}</p>)}</div> : <p className="mt-2 text-[12px] text-[#91a09c]">No data for this section yet.</p>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-[260px] place-items-center text-[#176b5b]"><LoaderCircle className="animate-spin" /></div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
