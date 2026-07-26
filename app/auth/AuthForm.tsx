"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { GoogleLogoIcon } from "@phosphor-icons/react/dist/csr/GoogleLogo";
import { LinkedinLogoIcon } from "@phosphor-icons/react/dist/csr/LinkedinLogo";
import { XLogoIcon } from "@phosphor-icons/react/dist/csr/XLogo";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { createClient } from "../../lib/supabase/client";

export function AuthForm({ appUrl, next, initialError }: { appUrl: string; next: string; initialError: string }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState(initialError);
  const [providerError, setProviderError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<"google" | "linkedin_oidc" | "x" | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    setProviderError("");
    const callback = new URL("/auth/callback", appUrl || window.location.origin);
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

  async function signInWithProvider(provider: "google" | "linkedin_oidc" | "x") {
    setLoadingProvider(provider);
    setError("");
    setProviderError("");
    const callback = new URL("/auth/callback", appUrl || window.location.origin);
    callback.searchParams.set("next", next);
    const { error: authError } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback.toString() },
    });
    if (authError) {
      const providerName = provider === "linkedin_oidc" ? "LinkedIn" : provider === "x" ? "X" : "Google";
      setProviderError(`We couldn’t connect to ${providerName}. Please try again.`);
      setLoadingProvider(null);
    }
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
    <div className="auth-options">
      <form onSubmit={submit} noValidate>
        <TextField id="auth-email" label="Email address" type="email" autoComplete="email" inputMode="email"
          placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)}
          leadingIcon={<EnvelopeSimpleIcon size={21} weight="bold" />} error={error} autoFocus />
        <Button fullWidth type="submit" disabled={loading || !email || Boolean(loadingProvider)}>
          {loading ? "Sending secure link…" : "Continue"} {!loading && <ArrowRightIcon size={20} weight="bold" />}
        </Button>
      </form>
      <div className="auth-divider"><span>or continue with</span></div>
      <div className="provider-list">
        <Button className="provider-button" fullWidth variant="secondary" disabled={Boolean(loadingProvider)} onClick={() => void signInWithProvider("google")}>
          <GoogleLogoIcon size={21} weight="bold" />
          {loadingProvider === "google" ? "Connecting to Google…" : "Continue with Google"}
          <span>Account</span>
        </Button>
        <Button className="provider-button" fullWidth variant="secondary" disabled={Boolean(loadingProvider)} onClick={() => void signInWithProvider("linkedin_oidc")}>
          <LinkedinLogoIcon size={21} weight="fill" />
          {loadingProvider === "linkedin_oidc" ? "Connecting to LinkedIn…" : "Continue with LinkedIn"}
          <span>Profile</span>
        </Button>
        <Button className="provider-button" fullWidth variant="secondary" disabled={Boolean(loadingProvider)} onClick={() => void signInWithProvider("x")}>
          <XLogoIcon size={20} weight="bold" />
          {loadingProvider === "x" ? "Connecting to X…" : "Continue with X"}
          <span>Profile</span>
        </Button>
      </div>
      {providerError && <p className="auth-provider-error" role="alert">{providerError}</p>}
      <p className="auth-terms">By continuing, you agree to the Terms of Use and acknowledge the Privacy Policy.</p>
    </div>
  );
}
