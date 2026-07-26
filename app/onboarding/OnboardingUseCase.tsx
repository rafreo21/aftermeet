"use client";

import { useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { BuildingsIcon } from "@phosphor-icons/react/dist/csr/Buildings";
import { UserIcon } from "@phosphor-icons/react/dist/csr/User";
import { Button } from "../components/Button";

type UseCase = "personal" | "team";

export function OnboardingUseCase() {
  const [choice, setChoice] = useState<UseCase>("personal");

  function continueFlow() {
    window.location.assign(choice === "personal" ? "/onboarding/card" : "/onboarding/profile?mode=team");
  }

  return (
    <div className="onboarding-use-case">
      <fieldset className="onboarding-choices">
        <legend className="sr-only">How will you use AfterMeet?</legend>
        <label className={`onboarding-choice${choice === "personal" ? " selected" : ""}`}>
          <input type="radio" name="use-case" value="personal" checked={choice === "personal"} onChange={() => setChoice("personal")} />
          <span className="onboarding-choice-icon" aria-hidden="true"><UserIcon size={22} weight="bold" /></span>
          <span className="onboarding-choice-copy">
            <strong>For me only</strong>
            <small>Create your card, share it at events, and remember the people you meet.</small>
          </span>
        </label>
        <label className={`onboarding-choice${choice === "team" ? " selected" : ""}`}>
          <input type="radio" name="use-case" value="team" checked={choice === "team"} onChange={() => setChoice("team")} />
          <span className="onboarding-choice-icon" aria-hidden="true"><BuildingsIcon size={22} weight="bold" /></span>
          <span className="onboarding-choice-copy">
            <strong>For my team or company</strong>
            <small>Set up a shared workspace first. You can add branded cards for members later.</small>
          </span>
        </label>
      </fieldset>
      <Button fullWidth type="button" onClick={continueFlow}>
        Continue <ArrowRightIcon size={20} weight="bold" />
      </Button>
    </div>
  );

}
