"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";

export function OnboardingForm({ initialName }: { initialName: string }) {
  const [displayName, setDisplayName] = useState(initialName);
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London");
  const [locale, setLocale] = useState(() => navigator.language || "en-GB");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (displayName.trim().length < 2) return setError("Enter the name you want AfterMeet to use.");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), timeZone, locale }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "We couldn’t save your workspace. Please try again.");
        return;
      }
      window.location.assign("/app");
    } catch {
      setError("We couldn’t reach AfterMeet. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="onboarding-form" onSubmit={submit}>
      <TextField label="Display name" name="displayName" autoComplete="name" value={displayName}
        onChange={(event) => setDisplayName(event.target.value)} error={error} autoFocus />
      <div className="onboarding-fields">
        <TextField label="Time zone" name="timeZone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} />
        <TextField label="Locale" name="locale" value={locale} onChange={(event) => setLocale(event.target.value)} />
      </div>
      <Button type="submit" loading={loading}>{loading ? "Saving workspace…" : "Continue to AfterMeet"} {!loading && <ArrowRightIcon weight="bold" />}</Button>
    </form>
  );
}
