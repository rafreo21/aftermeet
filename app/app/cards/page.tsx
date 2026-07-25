"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { AppShell } from "../../components/AppShell";
import { Button, LinkButton } from "../../components/Button";
import { contactMethodHref, contactMethodOpensNewTab } from "../../../lib/contact-methods";
import {
  createLibraryCard,
  getActiveCardId,
  type LibraryCard,
  MAX_CARDS,
  readCardLibrary,
  removeLibraryCard,
  setActiveCardId,
  upsertLibraryCard,
} from "../../../lib/card-library";
import "../product.css";
import "../flow.css";

type Method = { id: string; type: string; value: string; label: string };
type Profile = LibraryCard & { email: string; website: string };
const fallback: Profile = {
  id: "primary-card", slug: "alex-morgan", label: "My primary card",
  name: "Alex Morgan", role: "Independent Consultant", company: "Northstar Advisory",
  bio: "I help growing teams turn messy ideas into clear products people want.",
  email: "alex@example.com", website: "https://northstar.example", theme: "#9fe870", photo: "", companyLogo: "", coverPhoto: "",
  createdAt: "", updatedAt: "",
  methods: [
    { id: "email", type: "email", value: "alex@example.com", label: "Work" },
    { id: "website", type: "website", value: "https://northstar.example", label: "Visit my website" },
  ],
};

export default function CardsPage() {
  const [profile, setProfile] = useState(fallback);
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [activeId, setActiveId] = useState(fallback.id);
  const [photo, setPhoto] = useState("");
  const [qr, setQr] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const [svgCopied, setSvgCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("http://localhost:3000/c/alex-morgan");

  useEffect(() => {
    let nextProfile = fallback;
    try {
      let library = readCardLibrary(localStorage);
      if (!library.length) {
        const primary = createLibraryCard(fallback);
        library = upsertLibraryCard(localStorage, primary);
      }
      const selectedId = getActiveCardId(localStorage, library);
      const selected = library.find((card) => card.id === selectedId) || library[0];
      nextProfile = toProfile(selected);
      setCards(library);
      setActiveId(selected.id);
      setProfile(nextProfile);
      setPhoto(selected.photo || "");
    } catch {}
    setShareUrl(`${window.location.origin}/c/${nextProfile.slug}`);
  }, []);

  useEffect(() => {
    const options = {
      width: 900,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#163300", light: "#ffffff" },
    } as const;
    QRCode.toDataURL(shareUrl, options).then(setQr);
    QRCode.toString(shareUrl, { ...options, type: "svg" }).then(setQrSvg);
  }, [shareUrl]);

  function toProfile(card: LibraryCard): Profile {
    return {
      ...card,
      email: card.methods.find((item) => item.type === "email")?.value || "",
      website: card.methods.find((item) => item.type === "website")?.value || "",
    };
  }

  function selectCard(card: LibraryCard) {
    setActiveCardId(localStorage, card.id);
    setActiveId(card.id);
    setProfile(toProfile(card));
    setPhoto(card.photo || "");
    setShareUrl(`${window.location.origin}/c/${card.slug}`);
  }

  function createCard() {
    if (cards.length >= MAX_CARDS) return;
    const card = createLibraryCard({
      label: `Card ${cards.length + 1}`,
      theme: ["#9fe870", "#2495e8", "#ff9f43", "#a83df0", "#14b8a6"][cards.length],
    });
    upsertLibraryCard(localStorage, card);
    window.location.href = `/app/card/edit?id=${card.id}`;
  }

  function deleteActiveCard() {
    if (cards.length <= 1 || !window.confirm(`Delete “${profile.label}”? This cannot be undone.`)) return;
    const next = removeLibraryCard(localStorage, activeId);
    setCards(next);
    selectCard(next[0]);
  }

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
      title="My cards"
      subtitle={`${cards.length || 1} of ${MAX_CARDS} cards created`}
      actions={<Button size="small" disabled={cards.length >= MAX_CARDS} onClick={createCard}><PlusIcon size={16} weight="bold" /> New card</Button>}
    >
      <div className="flow-page">
        <div className="flow-heading"><div><span className="step-pill">Cards + permanent QR</span><h1>One card for every context.</h1><p>Create up to five cards. Each receives its own permanent, high-resilience QR code that never changes when you edit the card.</p></div></div>
        <section className="card-library" aria-label="Your cards">
          <div className="card-library-list">
            {cards.map((card) => (
              <button
                aria-pressed={card.id === activeId}
                className={card.id === activeId ? "selected" : ""}
                key={card.id}
                onClick={() => selectCard(card)}
                type="button"
              >
                <span style={{ background: card.theme }}><QrCodeIcon weight="bold" /></span>
                <span><strong>{card.label}</strong><small>{card.name || "Not finished yet"}</small></span>
              </button>
            ))}
            {cards.length < MAX_CARDS && <button className="add-card" onClick={createCard} type="button"><PlusIcon weight="bold" /><span><strong>Add card</strong><small>{MAX_CARDS - cards.length} remaining</small></span></button>}
          </div>
          <div className="card-library-actions">
            <LinkButton size="small" variant="secondary" href={`/app/card/edit?id=${activeId}`}><PencilSimpleIcon size={16} weight="bold" /> Edit selected</LinkButton>
            <Button size="small" variant="ghost" disabled={cards.length <= 1} onClick={deleteActiveCard}><TrashIcon size={16} /> Delete</Button>
          </div>
        </section>
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
              <LinkButton fullWidth variant="secondary" href={`/app/card/edit?id=${activeId}`}><PencilSimpleIcon size={17} weight="bold" />Edit card</LinkButton>
            </div>
          </article>
          <section className="inline-qr-panel">
            <div className="inline-qr-head"><span><QrCodeIcon size={22} weight="bold" /></span><div><h2>Scan to connect</h2><p>Point a phone camera at this code to open your card.</p></div></div>
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
