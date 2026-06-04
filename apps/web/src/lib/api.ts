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
  ats_score: number; ats_breakdown: Record<string, number>; ats_recommendations: string[]; high_fit: boolean; approval_status: string;
  saved: boolean; application_id: string | null;
};
export type ApplicationRecord = { id: string; job_id: string; company: string; title: string; status: string; notes: string | null; created_at: string; applied_at: string | null };
export type ApplicationEvent = { id: string; event_type: string; from_status: string | null; to_status: string | null; occurred_at: string };
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
export type DashboardSummary = { applications: number; interviews: number; saved_jobs: number; average_match_score: number | null; weekly_activity: number[] };
export type ApplicationMaterials = { application: ApplicationRecord; resume_version_id: string; ats_score: number; resume_content: Record<string, unknown>; cover_letter_id: string; cover_letter: string; provenance: string };
export type ResumeVersionRecord = { id: string; job_id: string; job_title: string; company: string; ats_score: number; created_at: string };
export type AnalyticsSummary = { total_applications: number; interview_rate: number; offer_rate: number; status_counts: Record<string, number> };
export type SkillRecommendation = { skill: string; mention_count: number; approved_role_count: number; high_fit_role_count: number; reason: string };
export type JobPreferences = { role_keywords: string; location: string; remote_only: boolean };
export type Subscription = { plan: string; status: string; owner_bypass: boolean; features: string[] };
export type ProviderHealth = { name: string; status: string; last_checked_at: string | null; last_result_count: number | null };
export type ManualJob = { title: string; company: string; location: string; url: string; description: string };
export type ExtensionPairingCode = { code: string; expires_at: string };

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

export async function downloadResumeVersion(versionId: string, format: "docx" | "pdf", accessToken: string): Promise<void> {
  const response = await fetch(`${apiUrl}/resume-versions/${versionId}/download?format=${format}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not download this resume version.");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `tailored-resume.${format}`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
