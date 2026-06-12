export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";
export const accessTokenKey = "jobcopilot_access_token";

export type CurrentUser = {
  id: string;
  email: string;
  status: string;
  role: "member" | "admin";
};

export type ResumeProfile = {
  id: string;
  original_filename: string;
  mime_type: string;
  parse_status: string;
  extracted_text: string;
  detected_sections: string[];
  skills: string[];
  experiences: ResumeExperience[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
};

export type ResumeExperience = { title: string; company: string; description: string };
export type ResumeEducation = { institution: string; degree: string; year: string | null };
export type ResumeCertification = { name: string; issuer: string | null; year: string | null };
export type JobRecommendation = {
  id: string; title: string; company: string; location: string; work_mode: string; salary: string | null;
  description: string; source: string; url: string; posted_at: string | null; match_score: number;
  matching_skills: string[]; missing_skills: string[]; experience_match: number;
  ats_score: number; ats_breakdown: Record<string, number>; ats_recommendations: string[]; recommendation_summary: string; recommendation_reasons: string[]; high_fit: boolean; approval_status: string;
  saved: boolean; application_id: string | null;
};
export type ApplicationRecord = { id: string; job_id: string; company: string; title: string; status: string; notes: string | null; created_at: string; applied_at: string | null };
export type ApplicationEvent = { id: string; event_type: string; from_status: string | null; to_status: string | null; metadata: Record<string, unknown>; occurred_at: string };
export type ActivityLog = { id: string; event_type: string; metadata: Record<string, unknown>; created_at: string };
export type InterviewRecord = { id: string; interview_round: string; scheduled_at: string; notes: string | null };
export type AssistedApplicationChecklist = {
  application_id: string;
  duplicate_prevention: boolean;
  ats_approved: boolean;
  resume_prepared: boolean;
  resume_version_id: string | null;
  cover_letter_prepared: boolean;
  cover_letter_id: string | null;
  target_url: string;
  manual_final_submission_required: boolean;
};
export type AutomationCapability = {
  site_key: string;
  site_name: string;
  domains: string[];
  capture_supported: boolean;
  autofill_supported: boolean;
  resume_upload_supported: boolean;
  dry_run_supported: boolean;
  manual_submit_required: boolean;
};
export type AutomationDryRunStep = { order: number; action: string; description: string; requires_user_review: boolean };
export type ApplicationAutomationPlan = {
  application_id: string;
  job_title: string;
  company: string;
  target_url: string;
  capability: AutomationCapability;
  steps: AutomationDryRunStep[];
  warnings: string[];
  manual_final_submission_required: boolean;
};
export type AutomationRun = {
  id: string;
  application_id: string;
  site_key: string;
  status: string;
  current_step: string | null;
  warnings: string[];
  result: Record<string, unknown>;
  manual_final_submission_required: boolean;
  created_at: string;
  updated_at: string;
};
export type BackgroundJob = {
  id: string;
  job_type: string;
  status: string;
  attempts: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};
export type ReviewAutofillField = {
  field_key: string;
  label: string;
  value: string;
  confidence: number;
  source: string;
  sensitive: boolean;
  requires_review: boolean;
};
export type ReviewBeforeApply = {
  application_id: string;
  job_id: string;
  job_title: string;
  company: string;
  location: string;
  source: string;
  target_url: string;
  match_score: number | null;
  ats_score: number | null;
  resume_version_id: string | null;
  cover_letter_id: string | null;
  resume_summary: string | null;
  cover_letter_preview: string | null;
  resume_prepared: boolean;
  cover_letter_prepared: boolean;
  autofill_fields: ReviewAutofillField[];
  missing_fields: string[];
  quality_warnings: string[];
  warnings: string[];
  review_confirmed: boolean;
  manual_final_submission_required: boolean;
};
export type DashboardSummary = { applications: number; interviews: number; saved_jobs: number; average_match_score: number | null; weekly_activity: number[] };
export type ApplicationMaterials = {
  application: ApplicationRecord;
  resume_version_id: string;
  ats_score: number;
  resume_content: Record<string, unknown>;
  cover_letter_id: string;
  cover_letter: string;
  provenance: string;
  generation_status: string;
  retry_attempts: number;
};
export type CoverLetterRecord = { id: string; content: string; created_at: string };
export type ResumeVersionRecord = { id: string; job_id: string; job_title: string; company: string; ats_score: number; created_at: string };
export type ResumeExperienceDraft = { title: string; company: string; description: string };
export type ResumeContentDraft = {
  professional_summary?: string;
  skills: string[];
  experience: ResumeExperienceDraft[];
  [key: string]: unknown;
};
export type ResumeVersionDetail = ResumeVersionRecord & { resume_content: ResumeContentDraft };
export type AnalyticsSummary = { total_applications: number; interview_rate: number; offer_rate: number; status_counts: Record<string, number> };
export type SkillRecommendation = { skill: string; mention_count: number; approved_role_count: number; high_fit_role_count: number; reason: string };
export type JobPreferences = { role_keywords: string; location: string; remote_only: boolean };
export type Subscription = { plan: string; status: string; owner_bypass: boolean; features: string[] };
export type ProviderHealth = { name: string; status: string; last_checked_at: string | null; last_result_count: number | null; retry_attempts: number; last_error: string | null };
export type ManualJob = { title: string; company: string; location: string; url: string; description: string };
export type ExtensionPairingCode = { code: string; expires_at: string };
export type AdminSummary = { users: number; applications: number; jobs: number; resume_versions: number; cover_letters: number; subscriptions: Record<string, number> };

type TokenResponse = {
  access_token: string;
};

let activeRefresh: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (activeRefresh) return activeRefresh;
  activeRefresh = requestAccessTokenRefresh();
  try {
    return await activeRefresh;
  } finally {
    activeRefresh = null;
  }
}

async function requestAccessTokenRefresh(): Promise<string | null> {
  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) return null;

  const body = (await response.json()) as TokenResponse;
  sessionStorage.setItem(accessTokenKey, body.access_token);
  return body.access_token;
}

export async function loadCurrentUser(accessToken: string): Promise<CurrentUser | null> {
  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as CurrentUser;
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(accessTokenKey);
}

export async function loadResumeProfile(accessToken: string): Promise<ResumeProfile | null> {
  const response = await fetch(`${apiUrl}/resumes/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load your resume profile.");
  return (await response.json()) as ResumeProfile | null;
}

export async function loadResumeVersions(accessToken: string): Promise<ResumeVersionRecord[]> {
  const response = await fetch(`${apiUrl}/resume-versions`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load resume versions.");
  return (await response.json()) as ResumeVersionRecord[];
}

export async function loadResumeVersion(versionId: string, accessToken: string): Promise<ResumeVersionDetail> {
  const response = await fetch(`${apiUrl}/resume-versions/${versionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load this resume version.");
  return (await response.json()) as ResumeVersionDetail;
}

export async function saveResumeVersion(versionId: string, resumeContent: ResumeContentDraft, accessToken: string): Promise<ResumeVersionDetail> {
  const response = await fetch(`${apiUrl}/resume-versions/${versionId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ resume_content: resumeContent }),
  });
  if (!response.ok) throw new Error("Could not save this resume version.");
  return (await response.json()) as ResumeVersionDetail;
}

export async function downloadResumeVersion(versionId: string, format: "docx" | "pdf", accessToken: string, acknowledgeQualityWarnings = false): Promise<void> {
  const params = new URLSearchParams({ format, acknowledge_quality_warnings: String(acknowledgeQualityWarnings) });
  const response = await fetch(`${apiUrl}/resume-versions/${versionId}/download?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    if (typeof detail?.message === "string" && Array.isArray(detail.quality_warnings)) {
      throw new Error(`${detail.message}\n${detail.quality_warnings.join("\n")}`);
    }
    throw new Error("Could not download this resume version.");
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `tailored-resume.${format}`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadCoverLetter(coverLetterId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${apiUrl}/cover-letters/${coverLetterId}/download`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not download this cover letter.");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "cover-letter.txt";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function loadCoverLetter(coverLetterId: string, accessToken: string): Promise<CoverLetterRecord> {
  const response = await fetch(`${apiUrl}/cover-letters/${coverLetterId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load this cover letter.");
  return (await response.json()) as CoverLetterRecord;
}

export async function saveCoverLetter(coverLetterId: string, content: string, accessToken: string): Promise<CoverLetterRecord> {
  const response = await fetch(`${apiUrl}/cover-letters/${coverLetterId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error("Could not save this cover letter.");
  return (await response.json()) as CoverLetterRecord;
}

export async function uploadResume(file: File, accessToken: string): Promise<ResumeProfile> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${apiUrl}/resumes/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Resume upload failed.");
  }
  return (await response.json()) as ResumeProfile;
}

export async function loadJobRecommendations(accessToken: string, query = "", location = ""): Promise<JobRecommendation[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  if (location.trim()) params.set("location", location.trim());
  const path = params.toString() ? `/jobs?${params.toString()}` : "/jobs";
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Could not load job recommendations.");
  }
  return (await response.json()) as JobRecommendation[];
}

export async function saveJob(jobId: string, accessToken: string): Promise<ApplicationRecord> {
  const response = await fetch(`${apiUrl}/jobs/${jobId}/save`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not save this job.");
  return (await response.json()) as ApplicationRecord;
}

export async function updateJobApproval(jobId: string, approvalStatus: "review_required" | "approved" | "dismissed", accessToken: string): Promise<void> {
  const response = await fetch(`${apiUrl}/jobs/${jobId}/approval`, {
    method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ approval_status: approvalStatus }),
  });
  if (!response.ok) throw new Error("Could not update review decision.");
}

export async function captureManualJob(job: ManualJob, accessToken: string): Promise<JobRecommendation> {
  const response = await fetch(`${apiUrl}/jobs/manual`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(job),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Could not capture this job.");
  }
  return (await response.json()) as JobRecommendation;
}

export async function loadApplications(accessToken: string): Promise<ApplicationRecord[]> {
  const response = await fetch(`${apiUrl}/applications`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load your applications.");
  return (await response.json()) as ApplicationRecord[];
}

export async function updateApplication(applicationId: string, payload: { status?: string; notes?: string }, accessToken: string): Promise<ApplicationRecord> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Could not update this application.");
  return (await response.json()) as ApplicationRecord;
}

export async function loadApplicationEvents(applicationId: string, accessToken: string): Promise<ApplicationEvent[]> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/events`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load application activity.");
  return (await response.json()) as ApplicationEvent[];
}

export async function loadAssistedApplicationChecklist(applicationId: string, accessToken: string): Promise<AssistedApplicationChecklist> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/assisted-checklist`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not load application readiness.");
  return (await response.json()) as AssistedApplicationChecklist;
}

export async function loadApplicationAutomationPlan(applicationId: string, accessToken: string): Promise<ApplicationAutomationPlan> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/automation-plan`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not load automation plan.");
  return (await response.json()) as ApplicationAutomationPlan;
}

export async function loadAutomationRuns(applicationId: string, accessToken: string): Promise<AutomationRun[]> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/automation-runs`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not load assisted run history.");
  return (await response.json()) as AutomationRun[];
}

export async function createAutomationRun(applicationId: string, accessToken: string): Promise<AutomationRun> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/automation-runs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Could not start assisted run.");
  }
  return (await response.json()) as AutomationRun;
}

export async function loadPrepareRuns(applicationId: string, accessToken: string): Promise<BackgroundJob[]> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/prepare-runs`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not load preparation runs.");
  return (await response.json()) as BackgroundJob[];
}

export async function createPrepareRun(applicationId: string, accessToken: string): Promise<BackgroundJob> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/prepare-runs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Could not queue material preparation.");
  }
  return (await response.json()) as BackgroundJob;
}

export async function retryBackgroundJob(jobId: string, accessToken: string): Promise<BackgroundJob> {
  const response = await fetch(`${apiUrl}/background-jobs/${jobId}/retry`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Could not retry this background job.");
  }
  return (await response.json()) as BackgroundJob;
}

export async function loadReviewBeforeApply(applicationId: string, accessToken: string): Promise<ReviewBeforeApply> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/review-before-apply`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not load review before applying.");
  return (await response.json()) as ReviewBeforeApply;
}

export async function confirmReviewBeforeApply(applicationId: string, accessToken: string): Promise<ReviewBeforeApply> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/review-before-apply/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not confirm application review.");
  return (await response.json()) as ReviewBeforeApply;
}

export async function loadInterviews(applicationId: string, accessToken: string): Promise<InterviewRecord[]> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/interviews`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Could not load interviews.");
  return (await response.json()) as InterviewRecord[];
}

export async function createInterview(applicationId: string, interview: Omit<InterviewRecord, "id">, accessToken: string): Promise<InterviewRecord> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/interviews`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(interview),
  });
  if (!response.ok) throw new Error("Could not schedule interview.");
  return (await response.json()) as InterviewRecord;
}

export async function updateInterview(applicationId: string, interviewId: string, interview: Partial<Omit<InterviewRecord, "id">>, accessToken: string): Promise<InterviewRecord> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/interviews/${interviewId}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(interview),
  });
  if (!response.ok) throw new Error("Could not update interview.");
  return (await response.json()) as InterviewRecord;
}

export async function deleteInterview(applicationId: string, interviewId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/interviews/${interviewId}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not remove interview.");
}

export async function prepareApplication(applicationId: string, accessToken: string): Promise<ApplicationMaterials> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}/prepare`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not prepare application materials.");
  return (await response.json()) as ApplicationMaterials;
}

export async function loadDashboardSummary(accessToken: string): Promise<DashboardSummary> {
  const response = await fetch(`${apiUrl}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load dashboard metrics.");
  return (await response.json()) as DashboardSummary;
}

export async function loadActivityLogs(accessToken: string): Promise<ActivityLog[]> {
  const response = await fetch(`${apiUrl}/activity/logs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load activity logs.");
  return (await response.json()) as ActivityLog[];
}

export async function loadAnalyticsSummary(accessToken: string): Promise<AnalyticsSummary> {
  const response = await fetch(`${apiUrl}/analytics/summary`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load analytics.");
  return (await response.json()) as AnalyticsSummary;
}

export async function loadSkillRecommendations(accessToken: string): Promise<SkillRecommendation[]> {
  const response = await fetch(`${apiUrl}/learning/skill-recommendations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load skill recommendations.");
  return (await response.json()) as SkillRecommendation[];
}

export async function loadJobPreferences(accessToken: string): Promise<JobPreferences> {
  const response = await fetch(`${apiUrl}/settings/job-preferences`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load job preferences.");
  return (await response.json()) as JobPreferences;
}

export async function saveJobPreferences(preferences: JobPreferences, accessToken: string): Promise<JobPreferences> {
  const response = await fetch(`${apiUrl}/settings/job-preferences`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });
  if (!response.ok) throw new Error("Could not save job preferences.");
  return (await response.json()) as JobPreferences;
}

export async function loadSubscription(accessToken: string): Promise<Subscription> {
  const response = await fetch(`${apiUrl}/billing/subscription`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load subscription details.");
  return (await response.json()) as Subscription;
}

export async function loadProviderHealth(): Promise<ProviderHealth[]> {
  const response = await fetch(`${apiUrl}/health/providers`);
  if (!response.ok) throw new Error("Could not load provider health.");
  return (await response.json()) as ProviderHealth[];
}

export async function loadAdminSummary(accessToken: string): Promise<AdminSummary> {
  const response = await fetch(`${apiUrl}/admin/summary`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load admin summary.");
  return (await response.json()) as AdminSummary;
}

export async function createExtensionPairingCode(accessToken: string): Promise<ExtensionPairingCode> {
  const response = await fetch(`${apiUrl}/extension/pairing-codes`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not create extension pairing code.");
  return (await response.json()) as ExtensionPairingCode;
}

export async function changePassword(currentPassword: string, newPassword: string, accessToken: string): Promise<void> {
  const response = await fetch(`${apiUrl}/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Could not change password.");
  }
}

export async function requestPasswordReset(email: string): Promise<{ message: string; reset_url: string | null }> {
  const response = await fetch(`${apiUrl}/auth/password-reset/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw new Error("Could not request password reset.");
  return (await response.json()) as { message: string; reset_url: string | null };
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const response = await fetch(`${apiUrl}/auth/password-reset/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Could not reset password.");
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${apiUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    sessionStorage.removeItem(accessTokenKey);
  }
}
