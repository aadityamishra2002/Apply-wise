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
};

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
