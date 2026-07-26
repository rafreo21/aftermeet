"use client";

import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PhoneIcon } from "@phosphor-icons/react/dist/csr/Phone";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { Button } from "./Button";
import { EnrichmentWaterfall } from "./EnrichmentWaterfall";
import {
  enrichmentSourceLabel,
  type EnrichmentField,
  type EnrichmentResult,
  type EnrichmentStep,
} from "../../lib/contact-enrichment";

export type ProfileFieldKey =
  | "fullName"
  | "workEmail"
  | "personalEmail"
  | "phone"
  | "role"
  | "company"
  | "linkedinUrl";

export type ProfileFieldRow = {
  key: ProfileFieldKey;
  label: string;
  value: string;
  placeholder?: string;
  source?: string;
  readOnly?: boolean;
  enrichable?: EnrichmentField;
};

type ProfileCaptureTableProps = {
  rows: ProfileFieldRow[];
  onChange: (key: ProfileFieldKey, value: string) => void;
  onEnrich?: (field: EnrichmentField) => Promise<void>;
  enrichingField?: EnrichmentField | null;
  enrichmentSteps?: EnrichmentStep[];
  error?: string;
};

function sourceBadge(source?: string) {
  if (!source) return <span className="capture-source capture-source-empty">—</span>;
  return <span className="capture-source">{source}</span>;
}

export function ProfileCaptureTable({
  rows,
  onChange,
  onEnrich,
  enrichingField,
  enrichmentSteps = [],
  error,
}: ProfileCaptureTableProps) {
  return (
    <div className="capture-table-wrap">
      <table className="capture-table">
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Value</th>
            <th scope="col">Source</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>
                <input
                  className="capture-table-input"
                  value={row.value}
                  readOnly={row.readOnly}
                  placeholder={row.placeholder}
                  onChange={(event) => onChange(row.key, event.target.value)}
                />
              </td>
              <td>{sourceBadge(row.source)}</td>
              <td className="capture-table-action">
                {row.enrichable && onEnrich ? (
                  <Button
                    type="button"
                    size="small"
                    variant="secondary"
                    loading={enrichingField === row.enrichable}
                    disabled={Boolean(enrichingField && enrichingField !== row.enrichable)}
                    onClick={() => void onEnrich(row.enrichable!)}
                  >
                    {row.enrichable === "email" ? (
                      <><EnvelopeSimpleIcon size={15} weight="bold" />Find work email</>
                    ) : (
                      <><PhoneIcon size={15} weight="bold" />Find phone</>
                    )}
                  </Button>
                ) : (
                  <span className="capture-source capture-source-empty">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {enrichingField ? (
        <div className="capture-enrichment-panel">
          <header>
            <MagnifyingGlassIcon size={18} weight="bold" />
            <div>
              <strong>Searching {enrichingField === "email" ? "email" : "phone"} sources</strong>
              <p>LinkedIn first, then pattern guess and enrichment providers.</p>
            </div>
          </header>
          <EnrichmentWaterfall steps={enrichmentSteps} />
        </div>
      ) : null}
      {error ? <p className="capture-table-error">{error}</p> : null}
    </div>
  );
}

export async function animateEnrichmentResult(
  result: EnrichmentResult,
  onStep: (steps: EnrichmentResult["steps"]) => void,
  delayMs = 320,
) {
  const revealed: EnrichmentResult["steps"] = [];
  for (const step of result.steps) {
    revealed.push({ ...step, status: step.status === "pending" ? "running" : step.status });
    onStep([...revealed]);
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    revealed[revealed.length - 1] = step;
    onStep([...revealed]);
    if (step.status === "found" && step.value) break;
  }
  onStep(result.steps);
  return result;
}

export function sourceLabelFromEnrichment(result: EnrichmentResult | null) {
  if (!result?.provider) return "";
  return enrichmentSourceLabel(result.provider);
}
