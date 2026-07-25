"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { createClient } from "../../lib/supabase/client";

export function AuthForm({ appUrl, next, initialError }: { appUrl: string; next: string; initialError: string }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    const callback = new URL("/auth/callback", appUrl);
    callback.searchParams.set("next", next);
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
    });
    setLoading(false);
    if (authError) {
      if (authError.code === "over_email_send_rate_limit") {
        setError("Supabase’s starter email service has reached its 2-email hourly limit. Try again one hour after the first email, or configure custom SMTP.");
      } else if (authError.status === 429 || authError.message.toLowerCase().includes("rate")) {
        setError("Too many sign-in attempts. Please wait a few minutes before trying again.");
      } else {
        setError("We couldn’t send the link. Please try again.");
      }
      return;
    }
    setSentTo(normalized);
  }

  if (sentTo) {
    return (
      <div className="auth-success" aria-live="polite">
        <div><CheckCircleIcon size={35} weight="fill" /></div>
        <span>Link sent</span>
        <h1>Check your inbox.</h1>
        <p>If an account can use <strong>{sentTo}</strong>, a secure sign-in link is on its way. It may take a minute.</p>
        <Button fullWidth onClick={() => void submit({ preventDefault() {} } as React.FormEvent)}>Resend link</Button>
        <Button fullWidth variant="ghost" onClick={() => { setSentTo(""); setError(""); }}>Use another email</Button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate>
      <TextField id="auth-email" label="Email address" type="email" autoComplete="email" inputMode="email"
        placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)}
        leadingIcon={<EnvelopeSimpleIcon size={21} weight="bold" />} error={error} autoFocus />
      <Button fullWidth type="submit" disabled={loading || !email}>
        {loading ? "Sending secure link…" : "Continue"} {!loading && <ArrowRightIcon size={20} weight="bold" />}
      </Button>
      <p className="auth-terms">By continuing, you agree to the Terms of Use and acknowledge the Privacy Policy.</p>
    </form>
  );
}
