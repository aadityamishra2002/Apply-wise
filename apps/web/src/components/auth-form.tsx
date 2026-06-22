"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { accessTokenKey, apiUrl } from "@/lib/api";

type Mode = "login" | "register";
const rememberedEmailKey = "applywise_remembered_email";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  useEffect(() => {
    if (isRegister) return;
    try {
      const savedEmail = localStorage.getItem(rememberedEmailKey);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    } catch {
      // Remember me is a convenience only; auth should keep working if storage is unavailable.
    }
  }, [isRegister]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const normalizedEmail = email.trim();
    try {
      const response = await fetch(`${apiUrl}/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(typeof body.detail === "string" ? body.detail : "Please check your details and try again.");
        return;
      }
      if (!isRegister) {
        try {
          if (rememberEmail) localStorage.setItem(rememberedEmailKey, normalizedEmail);
          else localStorage.removeItem(rememberedEmailKey);
        } catch {
          // Do not block login if browser storage is unavailable.
        }
      }
      sessionStorage.setItem(accessTokenKey, body.tokens.access_token);
      router.push("/dashboard");
    } catch {
      setError("The service is unavailable. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="text-[12px] font-bold text-[#53645f]">Email address</span>
          <input
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-[#dde5e1] px-3.5 py-3 text-[13px] outline-none focus:border-[#85b7aa]"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="avery@example.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label className="block">
          <span className="text-[12px] font-bold text-[#53645f]">Password</span>
          <input
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="mt-2 w-full rounded-xl border border-[#dde5e1] px-3.5 py-3 text-[13px] outline-none focus:border-[#85b7aa]"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isRegister ? "At least 8 characters" : "Your password"}
            required
            type="password"
            value={password}
          />
        </label>
        {!isRegister && (
          <div className="flex items-center justify-between text-[11px] font-bold">
            <label className="flex items-center gap-2 text-[#71807c]">
              <input
                checked={rememberEmail}
                onChange={(event) => {
                  setRememberEmail(event.target.checked);
                  if (!event.target.checked) {
                    try {
                      localStorage.removeItem(rememberedEmailKey);
                    } catch {
                      // Ignore storage failures for this non-security preference.
                    }
                  }
                }}
                type="checkbox"
              />
              Remember me
            </label>
            <Link className="text-[#176b5b]" href="/forgot-password">Forgot password?</Link>
          </div>
        )}
        {error && <p className="rounded-xl bg-[#fff1ee] px-3 py-2.5 text-[12px] font-bold text-[#a4483c]">{error}</p>}
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b5b] px-4 py-3.5 text-[13px] font-bold text-white disabled:opacity-70" disabled={submitting} type="submit">
          {submitting ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowRight size={15} />}
          {isRegister ? "Create my workspace" : "Log in"}
        </button>
      </form>
      <p className="mt-6 text-center text-[12px] text-[#8b9895]">
        {isRegister ? "Already have an account? " : "New to applywise? "}
        <Link className="font-bold text-[#176b5b]" href={isRegister ? "/login" : "/register"}>
          {isRegister ? "Log in" : "Create a free account"}
        </Link>
      </p>
    </>
  );
}
