"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { AppShell } from "../../components/AppShell";
import { Button, LinkButton } from "../../components/Button";
import { contactMethodHref, contactMethodOpensNewTab } from "../../../lib/contact-methods";
import "../product.css";
import "../flow.css";

type Method = { id: string; type: string; value: string; label: string };
type Profile = { slug?: string; name: string; role: string; company: string; bio: string; email: string; website: string; theme: string; photo: string; methods: Method[] };
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
const fallback: Profile = {
  name: "Alex Morgan", role: "Independent Consultant", company: "Northstar Advisory",
  bio: "I help growing teams turn messy ideas into clear products people want.",
  email: "alex@example.com", website: "https://northstar.example", theme: "#9fe870", photo: "",
  methods: [
    { id: "email", type: "email", value: "alex@example.com", label: "Work" },
    { id: "website", type: "website", value: "https://northstar.example", label: "Visit my website" },
  ],
};

export default function CardsPage() {
  const [profile, setProfile] = useState(fallback);
  const [photo, setPhoto] = useState("");
  const [qr, setQr] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const [svgCopied, setSvgCopied] = useState(false);
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrectionLevel>("M");
  const [shareUrl, setShareUrl] = useState("http://localhost:3000/c/alex-morgan");

  useEffect(() => {
    let nextProfile = fallback;
    try {
      const current = localStorage.getItem("aftermeet-card-v2");
      if (current) {
        const card = JSON.parse(current);
        nextProfile = {
          ...fallback, ...card,
          email: card.methods?.find((item: Method) => item.type === "email")?.value || "",
          website: card.methods?.find((item: Method) => item.type === "website")?.value || "",
        };
        setProfile(nextProfile);
        setPhoto(card.photo || "");
      } else {
        const stored = localStorage.getItem("aftermeet-profile-v1");
        if (stored) {
          nextProfile = { ...fallback, ...JSON.parse(stored) };
          setProfile(nextProfile);
        }
        setPhoto(localStorage.getItem("aftermeet-profile-photo-v1") || "");
      }
    } catch {}
    setShareUrl(`${window.location.origin}/c/${nextProfile.slug || "alex-morgan"}`);
  }, []);

  useEffect(() => {
    const options = {
      width: 900,
      margin: 2,
      errorCorrectionLevel: errorCorrection,
      color: { dark: "#163300", light: "#ffffff" },
    } as const;
    QRCode.toDataURL(shareUrl, options).then(setQr);
    QRCode.toString(shareUrl, { ...options, type: "svg" }).then(setQrSvg);
  }, [errorCorrection, shareUrl]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function copySvg() {
    await navigator.clipboard.writeText(qrSvg);
    setSvgCopied(true);
    window.setTimeout(() => setSvgCopied(false), 1400);
  }

  const initials = profile.name.split(" ").map((word) => word[0]).join("").slice(0, 2);
  const actionMethods = profile.methods.length
    ? profile.methods
    : [
        { id: "legacy-email", type: "email", value: profile.email, label: "Email" },
        { id: "legacy-website", type: "website", value: profile.website, label: "Website" },
      ].filter((method) => method.value);

  return (
    <AppShell
      active="cards"
      title="My card"
      subtitle="Create once, share everywhere, then capture what happens next."
      actions={<LinkButton size="small" href="/app/card/edit"><PencilSimpleIcon size={16} weight="bold" /> Edit card</LinkButton>}
    >
      <div className="flow-page">
        <div className="flow-heading"><div><span className="step-pill">My card + QR</span><h1>Everything you share, in one place.</h1><p>Edit your identity, present your card, and open a scannable QR without moving between separate pages.</p></div></div>
        <div className="card-share-layout" id="share">
          <article className="share-card-preview">
            <div className="share-card-cover" style={{ background: profile.theme }}><span>{profile.company[0] || "A"}</span><strong>{profile.company || "Your company"}</strong></div>
            <div className="share-card-body">
              <div className="share-avatar">{photo ? <img src={photo} alt="" /> : initials}</div>
              <h2>{profile.name}</h2>
              <p className="share-role">{profile.role}{profile.company ? ` · ${profile.company}` : ""}</p>
              <p>{profile.bio}</p>
              <div className="share-contact">
                {actionMethods.map((method) => {
                  const href = contactMethodHref(method);
                  return href
                    ? <a key={method.id} href={href} target={contactMethodOpensNewTab(href) ? "_blank" : undefined} rel={contactMethodOpensNewTab(href) ? "noreferrer" : undefined}>
                        <span><strong>{method.label}</strong><small>{method.value}</small></span><ArrowSquareOutIcon weight="bold" />
                      </a>
                    : <span className="unavailable-method" key={method.id}><strong>{method.label}</strong><small>{method.value}</small></span>;
                })}
              </div>
              <LinkButton fullWidth variant="secondary" href="/app/card/edit"><PencilSimpleIcon size={17} weight="bold" />Edit card</LinkButton>
            </div>
          </article>
          <section className="inline-qr-panel">
            <div className="inline-qr-head"><span><QrCodeIcon size={22} weight="bold" /></span><div><h2>Scan to connect</h2><p>Point a phone camera at this code to open your card.</p></div></div>
            <div className="qr-correction">
              <div>
                <strong>Scan resilience</strong>
                <span>{errorCorrection === "L" ? "Compact" : errorCorrection === "M" ? "Balanced" : errorCorrection === "Q" ? "Durable" : "Maximum"}</span>
              </div>
              <div className="qr-correction-options" aria-label="QR error correction level">
                {(["L", "M", "Q", "H"] as const).map((level) => (
                  <button
                    aria-pressed={errorCorrection === level}
                    className={errorCorrection === level ? "selected" : ""}
                    key={level}
                    onClick={() => setErrorCorrection(level)}
                    type="button"
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            {qr && <div className="inline-qr-frame"><img className="inline-qr-image" src={qr} alt={`QR code for ${profile.name}'s card`} /></div>}
            <div className="inline-qr-url">{shareUrl}</div>
            <div className="inline-qr-actions">
              <Button onClick={copyLink}><CopyIcon size={18} weight="bold" />{copied ? "Link copied" : "Copy link"}</Button>
              {qr && <LinkButton variant="secondary" href={qr} download="aftermeet-qr.png"><DownloadSimpleIcon size={18} weight="bold" />Download QR</LinkButton>}
            </div>
            <Button fullWidth variant="ghost" onClick={copySvg}><CopyIcon size={17} weight="bold" />{svgCopied ? "SVG copied" : "Copy as SVG"}</Button>
            <p className="qr-helper">After someone scans, add their details and meeting context so you know what to do next.</p>
            <LinkButton fullWidth variant="ghost" href="/app/contacts/new">Add someone you met</LinkButton>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
