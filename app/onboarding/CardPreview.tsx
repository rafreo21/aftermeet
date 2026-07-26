import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { PhoneIcon } from "@phosphor-icons/react/dist/csr/Phone";
import { Button } from "../components/Button";

type PreviewMethod = { type: string; value: string; label: string };

export function CardPreview({
  name,
  role,
  company,
  theme,
  email,
  phone,
}: {
  name: string;
  role: string;
  company: string;
  theme: string;
  email: string;
  phone: string;
}) {
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AM";
  const methods: PreviewMethod[] = [
    email.trim() ? { type: "email", value: email.trim(), label: "Email" } : null,
    phone.trim() ? { type: "phone", value: phone.trim(), label: "Phone" } : null,
  ].filter(Boolean) as PreviewMethod[];

  return (
    <div className="onboarding-phone">
      <div className="onboarding-phone-notch" aria-hidden="true" />
      <article className="public-card onboarding-card-preview">
        <div className="card-cover" style={{ background: theme }}>
          <div className="card-logo">{company.trim()[0]?.toUpperCase() || initials[0] || "A"}</div>
          <span>{company.trim() || "Your company"}</span>
        </div>
        <div className="card-body">
          <div className="card-avatar">{initials}</div>
          <h2>{name.trim() || "Your name"}</h2>
          <p className="card-role">
            {role.trim() || "Your role"}
            {company.trim() ? ` · ${company.trim()}` : ""}
          </p>
          <div className="card-methods">
            {methods.length ? methods.map((method) => (
              <div className="card-method" key={method.type}>
                <span>{method.type === "phone" ? <PhoneIcon size={18} weight="bold" /> : <EnvelopeSimpleIcon size={18} weight="bold" />}</span>
                <div><strong>{method.label}</strong><small>{method.value}</small></div>
              </div>
            )) : (
              <div className="card-method card-method-empty"><span><EnvelopeSimpleIcon size={18} weight="bold" /></span><div><strong>Email</strong><small>Add your email to preview it here</small></div></div>
            )}
          </div>
          <div className="card-actions"><Button fullWidth style={{ background: theme }}>Save contact</Button></div>
        </div>
      </article>
    </div>
  );
}
