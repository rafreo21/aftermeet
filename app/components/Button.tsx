import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type SharedButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "small" | "normal";
  fullWidth?: boolean;
  loading?: boolean;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & SharedButtonProps;
type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & SharedButtonProps & { href: string };

const variants = {
  primary:
    "bg-[#9fe870] text-[#163300] shadow-sm hover:bg-[#8dde5f] active:bg-[#7fd250] focus-visible:ring-[#9fe870]/50",
  secondary:
    "bg-[#f2f5f0] text-[#163300] hover:bg-[#e5e9e2] active:bg-[#dce2d8] focus-visible:ring-[#aeb8aa]/40",
  ghost:
    "bg-transparent text-[#163300] hover:bg-[#f2f5f0] active:bg-[#e5e9e2] focus-visible:ring-[#aeb8aa]/40",
};

const sizes = {
  small: "min-h-9 px-3 py-2 text-xs",
  normal: "min-h-11 px-4 py-2.5 text-sm",
};

function buttonClasses(
  variant: SharedButtonProps["variant"] = "primary",
  size: SharedButtonProps["size"] = "normal",
  fullWidth = false,
  className = "",
) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-md font-bold",
    "outline-none transition-colors focus-visible:ring-4",
    "disabled:cursor-not-allowed disabled:bg-[#e7eae5] disabled:text-[#858b82] disabled:shadow-none",
    variants[variant],
    sizes[size],
    fullWidth ? "w-full" : "",
    className,
  ].join(" ");
}

export function Button({
  children,
  variant = "primary",
  size = "normal",
  fullWidth = false,
  loading = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, fullWidth, className)}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  variant = "primary",
  size = "normal",
  fullWidth = false,
  loading: _loading = false,
  className = "",
  ...props
}: LinkButtonProps) {
  return (
    <a {...props} className={buttonClasses(variant, size, fullWidth, className)}>
      {children}
    </a>
  );
}

export function IconButton({
  children,
  size = "small",
  variant = "ghost",
  className = "",
  "aria-label": ariaLabel,
  ...props
}: Omit<ButtonProps, "fullWidth"> & { "aria-label": string }) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      aria-label={ariaLabel}
      className={buttonClasses(variant, size, false, [
        size === "small" ? "h-9 w-9 min-h-9 p-0" : "h-11 w-11 min-h-11 p-0",
        className,
      ].join(" "))}
    >
      {children}
    </button>
  );
}

export function IconLinkButton({
  children,
  size = "small",
  variant = "ghost",
  className = "",
  "aria-label": ariaLabel,
  ...props
}: Omit<LinkButtonProps, "fullWidth"> & { "aria-label": string }) {
  return (
    <a
      {...props}
      aria-label={ariaLabel}
      className={buttonClasses(variant, size, false, [
        size === "small" ? "h-9 w-9 min-h-9 p-0" : "h-11 w-11 min-h-11 p-0",
        className,
      ].join(" "))}
    >
      {children}
    </a>
  );
}
