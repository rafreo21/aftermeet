"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Button } from "../../components/Button";
import { TextField } from "../../components/FormField";

export function PublicExchangeForm({
  slug,
  ownerName,
  onSent,
}: {
  slug: string;
  ownerName: string;
  onSent?: (visitorEmail: string) => void;
}) {
  const [showRole, setShowRole] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [fullName, setFullName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorCompany, setVisitorCompany] = useState("");
  const [visitorRole, setVisitorRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const visitorName = fullName.trim();
    if (visitorName.length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!visitorEmail.trim() || !visitorEmail.includes("@")) {
      setError("Email is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/cards/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          visitorName,
          visitorEmail: visitorEmail.trim(),
          visitorPhone: visitorPhone.trim(),
          visitorCompany: visitorCompany.trim(),
          visitorRole: visitorRole.trim(),
          note: `Shared back from ${ownerName}'s AfterMeet card.`,
          consentGiven: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof payload.error === "string" ? payload.error : "We couldn’t send your details.");
        return;
      }
      onSent?.(visitorEmail.trim());
    } catch {
      setError("We couldn’t reach AfterMeet. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="public-exchange-form" onSubmit={submit} noValidate>
      <TextField
        id="exchange-full-name"
        label="Full name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        autoComplete="name"
        required
      />
      <TextField
        id="exchange-email"
        label="Email"
        type="email"
        value={visitorEmail}
        onChange={(event) => setVisitorEmail(event.target.value)}
        autoComplete="email"
        required
      />
      <TextField
        id="exchange-phone"
        label="Phone number (optional)"
        type="tel"
        value={visitorPhone}
        onChange={(event) => setVisitorPhone(event.target.value)}
        autoComplete="tel"
        placeholder="+1 555 000 0000"
      />

      <div className="public-exchange-optional">
        {!showRole ? (
          <button type="button" className="public-exchange-add" onClick={() => setShowRole(true)}>+ Job title</button>
        ) : (
          <TextField
            id="exchange-role"
            label="Job title (optional)"
            value={visitorRole}
            onChange={(event) => setVisitorRole(event.target.value)}
            autoComplete="organization-title"
          />
        )}
        {!showCompany ? (
          <button type="button" className="public-exchange-add" onClick={() => setShowCompany(true)}>+ Company name</button>
        ) : (
          <TextField
            id="exchange-company"
            label="Company name (optional)"
            value={visitorCompany}
            onChange={(event) => setVisitorCompany(event.target.value)}
            autoComplete="organization"
          />
        )}
      </div>

      {error ? <p className="public-exchange-error" role="alert">{error}</p> : null}
      <Button fullWidth type="submit" loading={loading}>
        {loading ? "Sending…" : "Send my details"} {!loading && <ArrowRightIcon size={18} weight="bold" />}
      </Button>
      <small className="public-exchange-privacy">We don&apos;t sell your contact details.</small>
    </form>
  );
}
