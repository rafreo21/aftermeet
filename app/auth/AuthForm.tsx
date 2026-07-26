"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { GoogleLogoIcon } from "@phosphor-icons/react/dist/csr/GoogleLogo";
import { LinkedinLogoIcon } from "@phosphor-icons/react/dist/csr/LinkedinLogo";
import { XLogoIcon } from "@phosphor-icons/react/dist/csr/XLogo";
import { appendVisitorIntentToCallback, type VisitorIntent } from "../../lib/auth/visitor-intent";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { createClient } from "../../lib/supabase/client";

type SocialProvider = "google" | "linkedin_oidc" | "x";
type ProviderAvailability = Record<SocialProvider, boolean> | null;

export function AuthForm({
  appUrl,
  next,
  visitorIntent,
  initialError,
  providerAvailability,
}: {
  appUrl: string;
  next: string;
  visitorIntent: VisitorIntent | null;
  initialError: string;
  providerAvailability: ProviderAvailability;
}) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState(initialError);
  const [providerError, setProviderError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

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
    appendVisitorIntentToCallback(callback, visitorIntent);
    try {
      const { error: authError } = await createClient().auth.signInWithOtp({
        email: normalized,
        options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
      });
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
    } catch {
      setError("We couldn’t reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithProvider(provider: SocialProvider) {
    const providerName = provider === "linkedin_oidc" ? "LinkedIn" : provider === "x" ? "X" : "Google";
    if (providerAvailability?.[provider] === false) {
      setProviderError(`${providerName} sign-in is not available yet. Continue securely with email.`);
      return;
    }
    setLoadingProvider(provider);
    setError("");
    setProviderError("");
    const callback = new URL("/auth/callback", appUrl || window.location.origin);
    callback.searchParams.set("next", next);
    appendVisitorIntentToCallback(callback, visitorIntent);
    try {
      const { error: authError } = await createClient().auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback.toString() },
      });
      if (authError) {
        setProviderError(`We couldn’t connect to ${providerName}. Continue with email or try again.`);
        setLoadingProvider(null);
      }
    } catch {
      setProviderError(`We couldn’t reach ${providerName}. Check your connection or continue with email.`);
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
        <Button fullWidth type="submit" loading={loading} disabled={!email || Boolean(loadingProvider)}>
          {loading ? "Sending secure link…" : "Continue"} {!loading && <ArrowRightIcon size={20} weight="bold" />}
        </Button>
      </form>
      <div className="auth-divider"><span>or continue with</span></div>
      {providerAvailability && !Object.values(providerAvailability).some(Boolean) && (
        <p className="auth-provider-notice" role="status">
          Social sign-in is being configured. Email sign-in is available now.
        </p>
      )}
      <div className="provider-list">
        <Button className="provider-button" fullWidth variant="secondary" disabled={Boolean(loadingProvider) || providerAvailability?.google === false} onClick={() => void signInWithProvider("google")}>
          <GoogleLogoIcon size={21} weight="bold" />
          {loadingProvider === "google" ? "Connecting to Google…" : "Continue with Google"}
          <span>{providerAvailability?.google === false ? "Soon" : "Account"}</span>
        </Button>
        <Button className="provider-button" fullWidth variant="secondary" disabled={Boolean(loadingProvider) || providerAvailability?.linkedin_oidc === false} onClick={() => void signInWithProvider("linkedin_oidc")}>
          <LinkedinLogoIcon size={21} weight="fill" />
          {loadingProvider === "linkedin_oidc" ? "Connecting to LinkedIn…" : "Continue with LinkedIn"}
          <span>{providerAvailability?.linkedin_oidc === false ? "Soon" : "Profile"}</span>
        </Button>
        <Button className="provider-button" fullWidth variant="secondary" disabled={Boolean(loadingProvider) || providerAvailability?.x === false} onClick={() => void signInWithProvider("x")}>
          <XLogoIcon size={20} weight="bold" />
          {loadingProvider === "x" ? "Connecting to X…" : "Continue with X"}
          <span>{providerAvailability?.x === false ? "Soon" : "Profile"}</span>
        </Button>
      </div>
      {providerError && <p className="auth-provider-error" role="alert">{providerError}</p>}
      <p className="auth-terms">By continuing, you agree to the Terms of Use and acknowledge the Privacy Policy.</p>
    </div>
  );
}
