"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { confirmPasswordReset } from "@/lib/api";

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) return setMessage("Passwords do not match.");
    setLoading(true);
    try {
      await confirmPasswordReset(token, password);
      setMessage("Password reset. You can now log in with the new password.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8f5] px-6">
      <section className="w-full max-w-md rounded-3xl border border-[#e4e8e3] bg-white p-8 small-shadow">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#91a09c]">Account recovery</p>
        <h1 className="mt-3 text-[26px] font-bold text-[#23312e]">Choose a new password</h1>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <input className="w-full rounded-xl border border-[#dce7e2] px-3 py-3 text-[13px] outline-none focus:border-[#79b6a8]" onChange={(event) => setPassword(event.target.value)} placeholder="New password" type="password" value={password} />
          <input className="w-full rounded-xl border border-[#dce7e2] px-3 py-3 text-[13px] outline-none focus:border-[#79b6a8]" onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm new password" type="password" value={confirm} />
          <button className="w-full rounded-xl bg-[#176b5b] px-4 py-3 text-[13px] font-bold text-white disabled:opacity-60" disabled={loading || !token || password.length < 8}>{loading ? "Resetting..." : "Reset password"}</button>
        </form>
        {message ? <p className="mt-4 rounded-xl bg-[#e8f4ef] p-3 text-[12px] font-bold text-[#176b5b]">{message}</p> : null}
        <Link className="mt-6 block text-[12px] font-bold text-[#71807c]" href="/login">Back to login</Link>
      </section>
    </main>
  );
}
