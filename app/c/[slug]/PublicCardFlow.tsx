"use client";

import { useState } from "react";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { GlobeIcon } from "@phosphor-icons/react/dist/csr/Globe";
import { LinkSimpleIcon } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { PhoneIcon } from "@phosphor-icons/react/dist/csr/Phone";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { Button } from "../../components/Button";
import { contactMethodHref } from "@/lib/contact-methods";
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

function MethodIcon({ type }: { type: string }) {
  if (type === "email") return <EnvelopeSimpleIcon aria-hidden size={21} weight="bold" />;
  if (type === "phone" || type === "whatsapp") return <PhoneIcon aria-hidden size={21} weight="bold" />;
  if (type === "address") return <MapPinIcon aria-hidden size={21} weight="bold" />;
  if (type === "website") return <GlobeIcon aria-hidden size={21} weight="bold" />;
  return <LinkSimpleIcon aria-hidden size={21} weight="bold" />;
}

export function PublicCardFlow({
  slug,
  ownerName,
  jobTitle,
  company,
  bio,
  methods,
}: {
  slug: string;
  ownerName: string;
  jobTitle: string | null;
  company: string | null;
  bio: string | null;
  methods: CardMethod[];
}) {
  const [step, setStep] = useState<Step>("save");
  const [showCoach, setShowCoach] = useState(false);
  const vcardUrl = `/c/${encodeURIComponent(slug)}/contact.vcf`;

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

  return (
    <>
      <ol className="public-card-steps" aria-label="Contact exchange steps">
        <li className={step === "save" ? "is-active" : "is-complete"}>
          <span>1</span>
          Save contact
        </li>
        <li className={step === "share" ? "is-active" : undefined}>
          <span>2</span>
          Share yours
        </li>
      </ol>

      {step === "save" ? (
        <div className="public-card-step">
          {bio ? <p className="public-card-bio">{bio}</p> : null}
          <div className="public-card-methods">
            {methods.map((method) => {
              const href = contactMethodHref({
                type: method.method_type,
                value: method.value,
              });
              if (!href) return null;
              return (
                <a
                  key={method.id}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  <MethodIcon type={method.method_type} />
                  <span>
                    <strong>{method.label || method.method_type}</strong>
                    <small>{method.value}</small>
                  </span>
                </a>
              );
            })}
          </div>

          <button type="button" className="public-card-return" onClick={handleSaveClick}>
            Save contact
          </button>
          <button type="button" className="ghost-link public-card-skip-save" onClick={() => setStep("share")}>
            Continue without saving
          </button>
          <p className="public-card-private">
            Save this card to your phone contacts. AfterMeet never exposes private meeting notes here.
          </p>
        </div>
      ) : (
        <div className="public-card-step public-card-step-share">
          <div className="public-card-share-summary">
            <strong>{ownerName}</strong>
            <span>{[jobTitle, company].filter(Boolean).join(" · ")}</span>
          </div>
          <PublicExchangeForm slug={slug} ownerName={ownerName} />
        </div>
      )}

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
    </>
  );
}
