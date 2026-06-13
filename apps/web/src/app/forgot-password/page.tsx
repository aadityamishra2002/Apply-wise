"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await requestPasswordReset(email);
      setMessage(response.message);
      setResetUrl(response.reset_url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8f5] px-6">
      <section className="w-full max-w-md rounded-3xl border border-[#e4e8e3] bg-white p-8 small-shadow">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#91a09c]">Account recovery</p>
        <h1 className="mt-3 text-[26px] font-bold text-[#23312e]">Reset your password</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#71807c]">Enter your account email. If automated reset delivery is unavailable, contact support from your registered email and we will help recover the account.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <input className="w-full rounded-xl border border-[#dce7e2] px-3 py-3 text-[13px] outline-none focus:border-[#79b6a8]" onChange={(event) => setEmail(event.target.value)} placeholder="Email address" type="email" value={email} />
          <button className="w-full rounded-xl bg-[#176b5b] px-4 py-3 text-[13px] font-bold text-white disabled:opacity-60" disabled={loading || !email}>{loading ? "Sending..." : "Request reset"}</button>
        </form>
        {message ? <p className="mt-4 rounded-xl bg-[#e8f4ef] p-3 text-[12px] font-bold text-[#176b5b]">{message}</p> : null}
        {resetUrl ? <Link className="mt-3 inline-flex text-[12px] font-bold text-[#176b5b] underline" href={resetUrl}>Open dev reset link</Link> : null}
        {!resetUrl && message ? <a className="mt-3 inline-flex text-[12px] font-bold text-[#176b5b] underline" href={`mailto:support@applywise.app?subject=Apply%20Wise%20account%20recovery&body=Registered%20email:%20${encodeURIComponent(email)}`}>Email support for recovery</a> : null}
        <Link className="mt-6 block text-[12px] font-bold text-[#71807c]" href="/login">Back to login</Link>
      </section>
    </main>
  );
}
