"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { AppShell } from "../../components/AppShell";
import { Button, LinkButton } from "../../components/Button";
import "../product.css";
import "../flow.css";

type Method = { id: string; type: string; value: string; label: string };
type Profile = { name: string; role: string; company: string; bio: string; email: string; website: string; theme: string; photo: string; methods: Method[] };
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
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window === "undefined" ? "http://localhost:3000/app" : `${window.location.origin}/app`;

  useEffect(() => {
    try {
      const current = localStorage.getItem("aftermeet-card-v2");
      if (current) {
        const card = JSON.parse(current);
        setProfile({
          ...fallback, ...card,
          email: card.methods?.find((item: Method) => item.type === "email")?.value || "",
          website: card.methods?.find((item: Method) => item.type === "website")?.value || "",
        });
        setPhoto(card.photo || "");
      } else {
        const stored = localStorage.getItem("aftermeet-profile-v1");
        if (stored) setProfile({ ...fallback, ...JSON.parse(stored) });
        setPhoto(localStorage.getItem("aftermeet-profile-photo-v1") || "");
      }
    } catch {}
    QRCode.toDataURL(shareUrl, { width: 900, margin: 2, color: { dark: "#163300", light: "#ffffff" } }).then(setQr);
  }, [shareUrl]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const initials = profile.name.split(" ").map((word) => word[0]).join("").slice(0, 2);

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
                {profile.methods.length ? profile.methods.map((method) => <span key={method.id}><strong>{method.label}:</strong> {method.value}</span>) : <><span>{profile.email}</span><span>{profile.website}</span></>}
              </div>
              <LinkButton fullWidth variant="secondary" href="/app/card/edit"><PencilSimpleIcon size={17} weight="bold" />Edit card</LinkButton>
            </div>
          </article>
          <section className="inline-qr-panel">
            <div className="inline-qr-head"><span><QrCodeIcon size={22} weight="bold" /></span><div><h2>Scan to connect</h2><p>Point a phone camera at this code to open your card.</p></div></div>
            {qr && <img className="inline-qr-image" src={qr} alt={`QR code for ${profile.name}'s card`} />}
            <div className="inline-qr-url">{shareUrl}</div>
            <div className="inline-qr-actions">
              <Button onClick={copyLink}><CopyIcon size={18} weight="bold" />{copied ? "Link copied" : "Copy link"}</Button>
              {qr && <LinkButton variant="secondary" href={qr} download="aftermeet-qr.png"><DownloadSimpleIcon size={18} weight="bold" />Download QR</LinkButton>}
            </div>
            <p className="qr-helper">After someone scans, add their details and meeting context so you know what to do next.</p>
            <LinkButton fullWidth variant="ghost" href="/app/contacts/new">Add someone you met</LinkButton>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
