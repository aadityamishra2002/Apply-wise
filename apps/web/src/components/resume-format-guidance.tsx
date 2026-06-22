import { FileText } from "lucide-react";

export function ResumeFormatGuidance({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-[#dbe8e2] bg-[#f6fbf9] ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e2f2ec] text-[#176b5b]">
          <FileText size={15} />
        </div>
        <div>
          <p className="text-[12px] font-bold text-[#176b5b]">Best format for tailored resumes</p>
          <p className="mt-1 text-[11px] leading-5 text-[#65736f]">
            DOCX master resumes work best. Uploaded DOCX templates preserve formatting better than PDF because Apply Wise tailors wording while keeping your selected resume/template layout. DOCX export should preserve fonts, margins, spacing, sections, bullets, and page layout more closely; PDF export may not be pixel-perfect.
          </p>
        </div>
      </div>
    </div>
  );
}
