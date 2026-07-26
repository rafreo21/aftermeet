"use client";

import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { CircleIcon } from "@phosphor-icons/react/dist/csr/Circle";
import { MinusCircleIcon } from "@phosphor-icons/react/dist/csr/MinusCircle";
import type { EnrichmentStep } from "../../lib/contact-enrichment";

function stepIcon(status: EnrichmentStep["status"]) {
  if (status === "found") return <CheckCircleIcon size={18} weight="fill" className="enrichment-step-icon found" />;
  if (status === "skipped") return <MinusCircleIcon size={18} className="enrichment-step-icon skipped" />;
  if (status === "miss") return <MinusCircleIcon size={18} className="enrichment-step-icon miss" />;
  return <CircleIcon size={18} className="enrichment-step-icon pending" />;
}

export function EnrichmentWaterfall({ steps }: { steps: EnrichmentStep[] }) {
  if (!steps.length) return null;

  return (
    <ol className="enrichment-waterfall" aria-label="Contact lookup progress">
      {steps.map((step, index) => (
        <li key={step.id} className={`enrichment-step enrichment-step-${step.status}`}>
          <span className="enrichment-step-track">
            {stepIcon(step.status)}
            {index < steps.length - 1 ? <span className="enrichment-step-line" aria-hidden="true" /> : null}
          </span>
          <div className="enrichment-step-body">
            <strong>{step.label}</strong>
            {step.status === "found" && step.value ? (
              <span className="enrichment-step-found">{step.value}</span>
            ) : step.detail ? (
              <small>{step.detail}</small>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
