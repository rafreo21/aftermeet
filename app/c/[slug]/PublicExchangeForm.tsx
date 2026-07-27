"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Button } from "../../components/Button";
import { VisitorSignInPrompt } from "../../components/VisitorSignInPrompt";
import { TextField } from "../../components/FormField";

export function PublicExchangeForm({
  slug,
  ownerName,
}: {
  slug: string;
  ownerName: string;
}) {
  const [showRole, setShowRole] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorCompany, setVisitorCompany] = useState("");
  const [visitorRole, setVisitorRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [exchangeId, setExchangeId] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const visitorName = `${firstName} ${lastName}`.trim();
    if (visitorName.length < 2) {
      setError("Enter your name.");
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
      setSent(true);
      if (typeof payload.exchangeId === "string") setExchangeId(payload.exchangeId);
    } catch {
      setError("We couldn’t reach AfterMeet. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="public-exchange-success" aria-live="polite">
        <CheckCircleIcon size={28} weight="fill" />
        <strong>Details sent to {ownerName}</strong>
        <p>Want to remember who you meet? Create a light AfterMeet account.</p>
        <VisitorSignInPrompt slug={slug} ownerName={ownerName} exchangeId={exchangeId} compact />
      </div>
    );
  }

  return (
    <form className="public-exchange-form" onSubmit={submit} noValidate>
      <div className="public-exchange-grid public-exchange-grid-names">
        <TextField
          id="exchange-first-name"
          label="First name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="given-name"
          required
        />
        <TextField
          id="exchange-last-name"
          label="Last name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          autoComplete="family-name"
        />
      </div>
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
