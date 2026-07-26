"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { IdentificationCardIcon } from "@phosphor-icons/react/dist/csr/IdentificationCard";
import { Button } from "../../components/Button";

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function SaveContactPrompt({ slug, ownerName }: { slug: string; ownerName: string }) {
  const [showCoach, setShowCoach] = useState(false);
  const vcardUrl = `/c/${encodeURIComponent(slug)}/contact.vcf`;

  function openContactFile() {
    window.location.href = vcardUrl;
  }

  function handleSaveClick() {
    if (isIosDevice()) {
      setShowCoach(true);
      return;
    }
    openContactFile();
  }

  if (showCoach) {
    return (
      <div className="public-save-coach" role="dialog" aria-modal="true" aria-labelledby="save-coach-title">
        <div className="public-save-coach-card">
          <IdentificationCardIcon size={34} weight="bold" />
          <h2 id="save-coach-title">Save {ownerName} to your phone</h2>
          <p>On the next screen, scroll down and tap <strong>Create New Contact</strong>.</p>
          <div className="public-save-coach-preview">
            <span>Create New Contact</span>
            <small>Add to Existing Contact</small>
          </div>
          <Button fullWidth onClick={openContactFile}>
            Continue <ArrowRightIcon size={18} weight="bold" />
          </Button>
          <button type="button" className="ghost-link" onClick={() => setShowCoach(false)}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="public-card-return" onClick={handleSaveClick}>
      Save contact
    </button>
  );
}
