"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { Button } from "../../components/Button";
import { ContactMethodIcon } from "../../components/ContactMethodIcon";
import { PublicAppDownloadPrompt } from "../../components/PublicAppDownloadPrompt";
import { contactMethodHref } from "@/lib/contact-methods";
import { themeCoverBadgeStyle, themeForegroundColor, themeSurfaceStyle } from "@/lib/theme-contrast";
import { PublicExchangeForm } from "./PublicExchangeForm";

type CardMethod = {
  id: string;
  method_type: string;
  label: string | null;
  value: string;
};

type Step = "save" | "share";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function PublicCardView({
  ownerName,
  jobTitle,
  company,
  companyLogoUrl,
  showCompanyDetails,
  bio,
  coverImageUrl,
  profileImageUrl,
  themeColor,
  methods,
  onSaveContact,
  onContinueWithoutSaving,
}: {
  ownerName: string;
  jobTitle: string | null;
  company: string | null;
  companyLogoUrl: string | null;
  showCompanyDetails: boolean;
  bio: string | null;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  themeColor: string;
  methods: CardMethod[];
  onSaveContact: () => void;
  onContinueWithoutSaving: () => void;
}) {
  const theme = themeSurfaceStyle(themeColor);
  const coverBadge = themeCoverBadgeStyle(themeColor);

  return (
    <>
      <div
        className="public-card-cover"
        style={{ background: coverImageUrl ? undefined : theme.backgroundColor }}>
        {coverImageUrl ? <img src={coverImageUrl} alt="" className="public-card-cover-photo" /> : null}
        {showCompanyDetails && (companyLogoUrl || company) ? (
          <div className="public-card-company-row">
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt="" className="public-card-company-logo" />
            ) : company ? (
              <span className="public-card-company-mark" style={coverBadge}>{company[0]}</span>
            ) : null}
            {company ? (
              <span className="public-card-company-name" style={{ color: coverImageUrl ? undefined : theme.color }}>
                {company}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="public-card-content">
        <div className="public-card-avatar">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt={ownerName} />
          ) : (
            <span>
              {ownerName
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")}
            </span>
          )}
        </div>
        <p className="public-card-brand">AFTERMEET</p>
        <h1>{ownerName}</h1>
        <p className="public-card-role">{[jobTitle, company].filter(Boolean).join(" · ")}</p>

        <div className="public-card-step">
          {bio ? <p className="public-card-bio">{bio}</p> : null}
          <div className="public-card-methods">
            {methods.map((method) => {
              const href = contactMethodHref({
                type: method.method_type,
                value: method.value,
              });
              if (!href) return null;
              const displayValue = href.startsWith("http") ? href : method.value;
              return (
                <a
                  key={method.id}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="public-card-method-link"
                >
                  <span
                    className="public-card-method-icon"
                    style={{ background: theme.backgroundColor, color: theme.color }}
                  >
                    <ContactMethodIcon type={method.method_type} color={theme.color} />
                  </span>
                  <span>
                    <strong>{method.label || method.method_type}</strong>
                    <small>{displayValue}</small>
                  </span>
                </a>
              );
            })}
          </div>

          <button
            type="button"
            className="public-card-return"
            style={{ background: theme.backgroundColor, color: theme.color }}
            onClick={onSaveContact}
          >
            Save contact
          </button>
          <button type="button" className="public-card-skip-save" onClick={onContinueWithoutSaving}>
            Continue without saving
          </button>
          <p className="public-card-private">
            Save this card to your phone contacts. AfterMeet never exposes private meeting notes here.
          </p>
        </div>
      </div>
    </>
  );
}

export function PublicCardClient({
  slug,
  ownerName,
  jobTitle,
  company,
  companyLogoUrl,
  showCompanyDetails,
  bio,
  coverImageUrl,
  profileImageUrl,
  themeColor,
  methods,
}: {
  slug: string;
  ownerName: string;
  jobTitle: string | null;
  company: string | null;
  companyLogoUrl: string | null;
  showCompanyDetails: boolean;
  bio: string | null;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  themeColor: string;
  methods: CardMethod[];
}) {
  const [step, setStep] = useState<Step>("save");
  const [showCoach, setShowCoach] = useState(false);
  const [showAppDownload, setShowAppDownload] = useState(false);
  const [visitorEmail, setVisitorEmail] = useState("");
  const vcardUrl = `/c/${encodeURIComponent(slug)}/contact.vcf`;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, showAppDownload]);

  function openContactFile() {
    if (isIosDevice()) {
      window.location.href = vcardUrl;
      return;
    }
    const link = document.createElement("a");
    link.href = vcardUrl;
    link.download = `${ownerName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "contact"}.vcf`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function goToShareStep() {
    setShowCoach(false);
    setStep("share");
  }

  function returnToCard() {
    setShowAppDownload(false);
    setStep("save");
  }

  function handleSaveClick() {
    if (isIosDevice()) {
      setShowCoach(true);
      return;
    }
    openContactFile();
    goToShareStep();
  }

  function handleCoachContinue() {
    openContactFile();
    goToShareStep();
  }

  function handleExchangeSent(email: string) {
    setVisitorEmail(email);
    setShowAppDownload(true);
  }

  const themeStyle = {
    "--card-accent": themeColor,
    "--card-on-accent": themeForegroundColor(themeColor),
  } as CSSProperties;

  if (showAppDownload) {
    return (
      <main className="public-card-page" style={themeStyle}>
        <PublicAppDownloadPrompt
          ownerName={ownerName}
          visitorEmail={visitorEmail}
          slug={slug}
          onClose={returnToCard}
        />
      </main>
    );
  }

  if (step === "share") {
    return (
      <main className="public-card-page" style={themeStyle}>
        <section className="public-card-shell public-card-shell-share">
          <div className="public-card-share-page">
            <div className="public-card-share-top">
              <button type="button" className="ghost-link public-card-share-skip" onClick={returnToCard}>
                Skip
              </button>
            </div>
            <div className="public-card-share-heading">
              <h1>Share your contact</h1>
              <p>Send your details to {ownerName} so they remember who you are.</p>
            </div>
            <PublicExchangeForm slug={slug} ownerName={ownerName} themeColor={themeColor} onSent={handleExchangeSent} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="public-card-page" style={themeStyle}>
      <section className="public-card-shell">
        <PublicCardView
          ownerName={ownerName}
          jobTitle={jobTitle}
          company={company}
          companyLogoUrl={companyLogoUrl}
          showCompanyDetails={showCompanyDetails}
          bio={bio}
          coverImageUrl={coverImageUrl}
          profileImageUrl={profileImageUrl}
          themeColor={themeColor}
          methods={methods}
          onSaveContact={handleSaveClick}
          onContinueWithoutSaving={goToShareStep}
        />
      </section>

      {showCoach ? (
        <div className="public-save-coach" role="dialog" aria-modal="true" aria-labelledby="save-coach-title">
          <div className="public-save-coach-card">
            <IdentificationCardIcon size={34} weight="bold" />
            <h2 id="save-coach-title">Save {ownerName} to your phone</h2>
            <p>
              On the next screen, scroll down and tap <strong>Create New Contact</strong> so iOS saves the right name,
              email, and links.
            </p>
            <div className="public-save-coach-preview">
              <span>Create New Contact</span>
              <small>Add to Existing Contact</small>
            </div>
            <Button fullWidth onClick={handleCoachContinue}>
              Continue <ArrowRightIcon size={18} weight="bold" />
            </Button>
            <button type="button" className="ghost-link" onClick={() => setShowCoach(false)}>
              Back
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
