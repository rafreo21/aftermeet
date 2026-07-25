import type { FieldsetHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type SharedProps = {
  label: string;
  hint?: string;
  error?: string;
  leadingIcon?: ReactNode;
};

type FormSectionProps = FieldsetHTMLAttributes<HTMLFieldSetElement> & {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
};

export function FormSection({
  title,
  description,
  icon,
  children,
  className = "",
  ...props
}: FormSectionProps) {
  return (
    <fieldset
      {...props}
      className={`m-0 min-w-0 rounded-lg border-0 bg-[#f2f5f0] p-5 sm:p-6 ${className}`}
    >
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#e2f6d5] text-[#163300]">
          {icon}
        </span>
        <div>
          <h3 className="m-0 text-base font-bold tracking-[-0.02em] text-[#163300]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#60675d]">{description}</p>
        </div>
      </div>
      <div className="grid gap-5">{children}</div>
    </fieldset>
  );
}

export function TextField({
  label,
  hint,
  error,
  leadingIcon,
  id,
  className = "",
  ...props
}: SharedProps & InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = id ?? `field-${props.name ?? label.toLowerCase().replace(/\s+/g, "-")}`;
  const descriptionId = hint || error ? `${fieldId}-description` : undefined;

  return (
    <div className={`grid gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={fieldId} className="text-sm font-semibold text-[#163300]">{label}</label>
        {hint && !error && <span className="text-xs text-[#6b7168]">{hint}</span>}
      </div>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#52604b]">
            {leadingIcon}
          </span>
        )}
        <input
          {...props}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          className={[
            "block min-h-12 w-full rounded-md border bg-white px-3.5 py-2.5 text-base text-[#163300]",
            "placeholder:text-[#858b82] outline-none transition",
            "focus:border-[#163300] focus:ring-4 focus:ring-[#9fe870]/35",
            "disabled:cursor-not-allowed disabled:bg-[#f2f5f0] disabled:text-[#858b82]",
            leadingIcon ? "pl-11" : "",
            error ? "border-[#b42318] focus:border-[#b42318] focus:ring-[#fecdca]/50" : "border-[#aeb8aa]",
          ].join(" ")}
        />
      </div>
      {error && <p id={descriptionId} className="text-sm font-medium text-[#b42318]">{error}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldId = id ?? `field-${props.name ?? label.toLowerCase().replace(/\s+/g, "-")}`;
  const descriptionId = hint || error ? `${fieldId}-description` : undefined;

  return (
    <div className={`grid gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={fieldId} className="text-sm font-semibold text-[#163300]">{label}</label>
        {hint && !error && <span id={descriptionId} className="text-xs text-[#6b7168]">{hint}</span>}
      </div>
      <textarea
        {...props}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        className={[
          "block w-full resize-y rounded-md border bg-white px-3.5 py-3 text-base text-[#163300]",
          "placeholder:text-[#858b82] outline-none transition",
          "focus:border-[#163300] focus:ring-4 focus:ring-[#9fe870]/35",
          "disabled:cursor-not-allowed disabled:bg-[#f2f5f0] disabled:text-[#858b82]",
          error ? "border-[#b42318] focus:border-[#b42318] focus:ring-[#fecdca]/50" : "border-[#aeb8aa]",
        ].join(" ")}
      />
      {error && <p id={descriptionId} className="text-sm font-medium text-[#b42318]">{error}</p>}
    </div>
  );
}
