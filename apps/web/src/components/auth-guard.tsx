"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import {
  accessTokenKey,
  loadCurrentUser,
  refreshAccessToken,
  type CurrentUser,
} from "@/lib/api";

export function AuthGuard({ children }: { children: (user: CurrentUser) => ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      try {
        let accessToken = sessionStorage.getItem(accessTokenKey);
        let currentUser = accessToken ? await loadCurrentUser(accessToken) : null;
        if (!currentUser) {
          accessToken = await refreshAccessToken();
          currentUser = accessToken ? await loadCurrentUser(accessToken) : null;
        }
        if (!currentUser) {
          sessionStorage.removeItem(accessTokenKey);
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (!cancelled) setUser(currentUser);
      } catch {
        sessionStorage.removeItem(accessTokenKey);
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    }

    void authenticate();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f9f6] text-[#176b5b]">
        <LoaderCircle className="animate-spin" size={24} />
      </div>
    );
  }

  return children(user);
}
