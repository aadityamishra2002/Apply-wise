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
};

export type ResumeExperience = { title: string; company: string; description: string };
export type JobRecommendation = {
  id: string; title: string; company: string; location: string; work_mode: string; salary: string | null;
  description: string; source: string; url: string; posted_at: string | null; match_score: number;
  matching_skills: string[]; missing_skills: string[]; experience_match: number;
};
export type ApplicationRecord = { id: string; job_id: string; company: string; title: string; status: string; created_at: string };
export type DashboardSummary = { applications: number; interviews: number; saved_jobs: number; average_match_score: number | null; weekly_activity: number[] };
export type ApplicationMaterials = { application: ApplicationRecord; resume_version_id: string; ats_score: number; resume_content: Record<string, unknown>; cover_letter_id: string; cover_letter: string };

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

export async function loadJobRecommendations(accessToken: string, query = ""): Promise<JobRecommendation[]> {
  const response = await fetch(`${apiUrl}/jobs?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load job recommendations.");
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

export async function loadApplications(accessToken: string): Promise<ApplicationRecord[]> {
  const response = await fetch(`${apiUrl}/applications`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not load your applications.");
  return (await response.json()) as ApplicationRecord[];
}

export async function updateApplicationStatus(applicationId: string, status: string, accessToken: string): Promise<ApplicationRecord> {
  const response = await fetch(`${apiUrl}/applications/${applicationId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error("Could not update this application.");
  return (await response.json()) as ApplicationRecord;
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
