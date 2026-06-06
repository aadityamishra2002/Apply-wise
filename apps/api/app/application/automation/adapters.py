from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class AutomationCapability:
    site_key: str
    site_name: str
    domains: tuple[str, ...]
    capture_supported: bool
    autofill_supported: bool
    resume_upload_supported: bool
    dry_run_supported: bool
    manual_submit_required: bool = True


@dataclass(frozen=True)
class DryRunStep:
    order: int
    action: str
    description: str
    requires_user_review: bool = True


CAPABILITIES: tuple[AutomationCapability, ...] = (
    AutomationCapability("linkedin", "LinkedIn", ("linkedin.com",), True, True, False, True),
    AutomationCapability("naukri", "Naukri", ("naukri.com",), True, True, False, True),
    AutomationCapability("indeed", "Indeed", ("indeed.",), True, True, False, True),
    AutomationCapability("workday", "Workday", ("myworkdayjobs.com",), True, True, False, True),
    AutomationCapability("greenhouse", "Greenhouse", ("greenhouse.io", "greenhouse.com"), True, True, False, True),
    AutomationCapability("lever", "Lever", ("lever.co",), True, True, False, True),
    AutomationCapability("ashby", "Ashby", ("ashbyhq.com",), True, True, False, True),
    AutomationCapability("smartrecruiters", "SmartRecruiters", ("smartrecruiters.com",), True, True, False, True),
    AutomationCapability("generic", "Generic career page", ("",), True, False, False, True),
)


def list_capabilities() -> list[AutomationCapability]:
    return list(CAPABILITIES)


def capability_for_url(url: str) -> AutomationCapability:
    host = urlparse(url).hostname or ""
    host = host.lower()
    for capability in CAPABILITIES:
        if capability.site_key == "generic":
            continue
        if any(domain in host for domain in capability.domains):
            return capability
    return next(capability for capability in CAPABILITIES if capability.site_key == "generic")


def build_dry_run_steps(capability: AutomationCapability, *, has_resume: bool, has_cover_letter: bool) -> list[DryRunStep]:
    steps = [
        DryRunStep(1, "open_site", f"Open the employer application page using the {capability.site_name} adapter."),
        DryRunStep(2, "inspect_fields", "Inspect visible form fields and compare them with the approved autofill plan."),
    ]
    if capability.autofill_supported:
        steps.append(DryRunStep(3, "prefill_reviewed_fields", "Prefill only fields the user approved in the review screen."))
    else:
        steps.append(DryRunStep(3, "manual_fill_required", "This site is not approved for assisted autofill yet; fill fields manually."))
    if has_resume:
        steps.append(DryRunStep(4, "resume_attachment", "Download the tailored resume and attach it manually where the site asks for a resume."))
    else:
        steps.append(DryRunStep(4, "prepare_resume_required", "Prepare a tailored resume before starting assisted application flow."))
    if has_cover_letter:
        steps.append(DryRunStep(5, "cover_letter_review", "Review the generated cover letter and paste it only if the site asks for one."))
    else:
        steps.append(DryRunStep(5, "prepare_cover_letter_required", "Prepare a cover letter before using cover-letter assistance."))
    steps.append(DryRunStep(6, "stop_before_submit", "Stop before final submit. User must manually review the employer form and submit themselves."))
    return steps
