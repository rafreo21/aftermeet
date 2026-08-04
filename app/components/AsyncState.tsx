import type { ReactNode } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";

export function StatusMessage({
  tone,
  children,
  action,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`status-message status-${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      {tone === "success" ? <CheckCircleIcon weight="fill" /> : tone === "error" ? <WarningCircleIcon weight="fill" /> : null}
      <div>{children}</div>
      {action}
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="loading-skeleton" aria-label="Loading content" aria-busy="true">
      <span className="skeleton loading-skeleton-heading" />
      <div className="loading-skeleton-rows">
        {Array.from({ length: rows }, (_, index) => <span className="skeleton loading-skeleton-row" key={index} />)}
      </div>
    </div>
  );
}
