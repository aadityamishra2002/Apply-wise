from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


ROOT = Path(__file__).parent
OUTPUT = ROOT / "APPLY_WISE_PRODUCT_STATUS.pdf"
GREEN = colors.HexColor("#176B5B")
INK = colors.HexColor("#23312E")
MUTED = colors.HexColor("#65736F")
LIGHT_GREEN = colors.HexColor("#E8F4EF")
LIGHT_GRAY = colors.HexColor("#F6F8F5")

styles = getSampleStyleSheet()
body = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.2, leading=12, textColor=INK, spaceAfter=5)
small = ParagraphStyle("Small", parent=body, fontSize=8.4, leading=10.5, textColor=MUTED)
title = ParagraphStyle("Title", parent=body, fontName="Helvetica-Bold", fontSize=24, leading=27, textColor=GREEN, spaceAfter=0)
subtitle = ParagraphStyle("Subtitle", parent=body, fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=INK, spaceAfter=2)
heading = ParagraphStyle("Heading", parent=body, fontName="Helvetica-Bold", fontSize=14, leading=17, textColor=GREEN, spaceBefore=7, spaceAfter=4)
bullet = ParagraphStyle("Bullet", parent=body, leftIndent=12, firstLineIndent=-7, bulletIndent=0, spaceAfter=2, fontSize=8.9, leading=11)
callout = ParagraphStyle("Callout", parent=body, fontName="Helvetica-Bold", fontSize=8.9, leading=11.5, textColor=INK)
cell = ParagraphStyle("Cell", parent=body, fontSize=8.1, leading=9.5, spaceAfter=0)
cell_header = ParagraphStyle("CellHeader", parent=cell, fontName="Helvetica-Bold", textColor=colors.white)


def para(text, style=body):
    return Paragraph(text, style)


def table(headers, rows, widths):
    values = [[para(value, cell_header) for value in headers]]
    values += [[para(value, cell) for value in row] for row in rows]
    result = Table(values, colWidths=widths, repeatRows=1)
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#DCE7E2")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return result


def page_furniture(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.drawRightString(7.75 * inch, 10.65 * inch, "APPLY WISE  /  PRODUCT STATUS")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(4.25 * inch, 0.35 * inch, f"Live product guide  |  Page {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(str(OUTPUT), pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch, topMargin=0.7 * inch, bottomMargin=0.6 * inch)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="content")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=page_furniture)])

story = [
    para("APPLY WISE", title),
    para("AI Job Application Copilot", subtitle),
    para("Product status and delivery roadmap", small),
    para("Updated June 2, 2026  |  Live: https://apply-wise-1.vercel.app", small),
    Spacer(1, 4),
    para("What is live", heading),
    para("Apply Wise is a deployed web product for resume-aware job discovery, truthful application preparation, and pipeline tracking. Users can register publicly and maintain private workspaces."),
    para("Live architecture", heading),
    table(
        ["Layer", "Technology", "Current role"],
        [
            ("Web app", "Next.js 15 / Vercel", "Responsive SaaS interface"),
            ("API", "FastAPI / Railway", "Authenticated application API"),
            ("Database", "PostgreSQL / Alembic", "Persistent product records"),
            ("Job source", "Adzuna API", "Live India listings with attribution"),
            ("Security", "JWT + refresh rotation", "Protected user workspaces"),
        ],
        [1.15 * inch, 1.8 * inch, 4.05 * inch],
    ),
    para("Implemented workflow", heading),
]
for item in [
    "Register, log in, log out, and refresh an authenticated session.",
    "Upload a PDF or DOCX master resume and review extracted evidence.",
    "Search live Adzuna listings and rank jobs against stored resume skills.",
    "Save roles, update statuses, and monitor dashboard and analytics metrics.",
    "Prepare Gemini-enhanced grounded drafts with deterministic fallback.",
    "Set role keywords, location, and remote-only discovery preferences.",
    "Add application notes and review visible tracker timeline events.",
    "Schedule interview rounds inside the application workspace.",
    "Download authenticated DOCX or PDF exports for prepared resume versions.",
    "Review persisted free-tier or owner-bypass subscription entitlements.",
    "Review non-secret health for the configured job-source aggregator.",
    "Reschedule interviews, edit preparation notes, or remove obsolete rounds.",
    "Paste a career-page role, score it, and save it into the tracker.",
    "Pair an unpacked Chrome extension and review job pages before scoring.",
]:
    story.append(Paragraph(item, bullet, bulletText="•"))
story += [
    para("Truthfulness rule", heading),
    Table([[para("Application drafts use stored resume evidence only. They do not invent employers, skills, projects, responsibilities, or achievements. Every draft remains review-required.", callout)]], colWidths=[7 * inch], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GREEN),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#B8D4CC")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ])),
    PageBreak(),
    para("Security and operations", heading),
]
for item in [
    "Argon2id password hashing and HTTP-only refresh cookies.",
    "Refresh-token rotation with replay detection and token-family revocation.",
    "Owner admin allowlist configured through Railway environment variables.",
    "Production secrets stored in Railway variables, not committed to Git.",
    "Railway health and PostgreSQL readiness probes.",
    "Schema changes managed with Alembic migrations.",
]:
    story.append(Paragraph(item, bullet, bulletText="•"))
story.append(para("Current limitations", heading))
for item in [
    "Adzuna is the only live provider adapter currently connected.",
    "Resume parsing is deterministic and requires user review.",
    "Gemini enhancement depends on API quota; grounded fallback drafts remain available.",
    "Razorpay checkout, webhooks, and paid-plan activation are not connected.",
    "Site-specific extension extractors and Playwright autofill remain future work.",
]:
    story.append(Paragraph(item, bullet, bulletText="•"))
story += [
    para("Next delivery slices", heading),
    table(
        ["Order", "Slice", "Outcome"],
        [
            ("1", "Razorpay billing", "Checkout, webhooks, and paid activation"),
            ("2", "Provider adapters", "More compliant listing sources"),
            ("3", "Extension extractors", "Site-specific capture and autofill plan"),
        ],
        [0.55 * inch, 2.05 * inch, 4.4 * inch],
    ),
    para("Repository practice", heading),
    para("README.md, docs/PRODUCT_STATUS.md, and this PDF snapshot are updated as product slices ship. Secrets remain outside the repository."),
    para("Repository: https://github.com/aadityamishra2002/Apply-wise", small),
]
doc.build(story)
print(OUTPUT)
