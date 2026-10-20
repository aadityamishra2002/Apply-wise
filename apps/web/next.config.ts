import type { NextConfig } from "next";

if (process.env.VERCEL === "1") {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
  let apiUrl: URL | null = null;
  try {
    apiUrl = configuredApiUrl ? new URL(configuredApiUrl) : null;
  } catch {
    apiUrl = null;
  }
  if (
    !apiUrl ||
    apiUrl.protocol !== "https:" ||
    apiUrl.username !== "" ||
    apiUrl.password !== "" ||
    apiUrl.search !== "" ||
    apiUrl.hash !== "" ||
    apiUrl.pathname.replace(/\/+$/, "") !== "/api/v1" ||
    apiUrl.hostname === "jobsearchautomation-production.up.railway.app"
  ) {
    throw new Error("Set NEXT_PUBLIC_API_URL to the active HTTPS API base URL ending in /api/v1 before deploying on Vercel.");
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

export default nextConfig;
