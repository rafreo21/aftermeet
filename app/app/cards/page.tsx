"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { QrCodeIcon } from "@phosphor-icons/react/dist/csr/QrCode";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUpIcon } from "@phosphor-icons/react/dist/csr/CaretUp";
import { ShareCardModal } from "../../components/ShareCardModal";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { AppShell } from "../../components/AppShell";
import { useAppUser } from "../../components/AppUserContext";
import { PageSkeleton, StatusMessage } from "../../components/AsyncState";
import { Button, LinkButton } from "../../components/Button";
import { contactMethodHref, contactMethodOpensNewTab } from "../../../lib/contact-methods";
import { buildHtmlSignature, buildPlainSignature } from "../../../lib/email-signature";
import { WalletSharePanel } from "../../components/WalletSharePanel";
import {
  createLibraryCard,
  getActiveCardId,
  type LibraryCard,
  MAX_CARDS,
  removeLibraryCard,
  setActiveCardId,
  upsertLibraryCard,
} from "../../../lib/card-library";
import { hydrateCardLibraryFromServer, queueCardSync } from "../../../lib/card-library-sync";
import { applyCardTemplate } from "../../../lib/card-templates";
import type { CardTemplate } from "../../../lib/workspace/types";
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
  const user = useAppUser();
  const [profile, setProfile] = useState(fallback);
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [isTeamWorkspace, setIsTeamWorkspace] = useState(false);
  const [activeId, setActiveId] = useState(fallback.id);
  const [photo, setPhoto] = useState("");
  const [qr, setQr] = useState("");
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const [svgCopied, setSvgCopied] = useState(false);
  const [signatureCopied, setSignatureCopied] = useState<"" | "plain" | "html">("");
  const [showWidgetHelp, setShowWidgetHelp] = useState(false);
  const [viewingCard, setViewingCard] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [qrError, setQrError] = useState("");
  const [shareUrl, setShareUrl] = useState("http://localhost:3000/c/alex-morgan");
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/workspace")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as {
          active?: { type?: string };
          templates?: CardTemplate[];
        };
        setIsTeamWorkspace(payload.active?.type === "team");
        setTemplates(payload.templates ?? []);
      })
      .catch(() => undefined);

    void hydrateCardLibraryFromServer().then((library) => {
      let nextProfile = fallback;
      if (!library.length) {
        setCards([]);
        setViewingCard(false);
        setHydrated(true);
        return;
      }
      const selectedId = getActiveCardId(localStorage, library);
      const requestedId = new URLSearchParams(window.location.search).get("id");
      const selected = library.find((card) => card.id === requestedId)
        || library.find((card) => card.id === selectedId)
        || library[0];
      nextProfile = toProfile(selected);
      setCards(library);
      setActiveId(selected.id);
      setProfile(nextProfile);
      setPhoto(selected.photo || "");
      setViewingCard(Boolean(requestedId && library.some((card) => card.id === requestedId)));
      setShareUrl(`${window.location.origin}/c/${nextProfile.slug}`);
      setHydrated(true);
    }).catch(() => {
      setQrError("We couldn’t load your saved cards. Refresh the page to try again.");
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    const options = {
      width: 900,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#163300", light: "#ffffff" },
    } as const;
    setQr("");
    setQrSvg("");
    setQrError("");
    Promise.all([
      QRCode.toDataURL(shareUrl, options),
      QRCode.toString(shareUrl, { ...options, type: "svg" }),
    ]).then(([image, svg]) => {
      setQr(image);
      setQrSvg(svg);
    }).catch(() => setQrError("We couldn’t generate this QR code. Check the card link and try again."));
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

  function openCard(card: LibraryCard) {
    selectCard(card);
    setViewingCard(true);
    window.history.pushState(null, "", `/app/cards?id=${card.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showCardLibrary() {
    setViewingCard(false);
    setShowWidgetHelp(false);
    window.history.pushState(null, "", "/app/cards");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function createCard(seed: Partial<LibraryCard> = {}) {
    if (cards.length >= MAX_CARDS) return;
    const card = createLibraryCard({
      label: `Card ${cards.length + 1}`,
      theme: ["#9fe870", "#2495e8", "#ff9f43", "#a83df0", "#14b8a6"][cards.length],
      ...seed,
    });
    upsertLibraryCard(localStorage, card);
    queueCardSync(card);
    window.location.href = `/app/card/edit?id=${card.id}`;
  }

  function createCardFromTemplate(template: CardTemplate) {
    if (cards.length >= MAX_CARDS) return;
    const card = applyCardTemplate(template, {
      memberName: user.displayName || "",
      memberEmail: user.email,
      label: template.name,
    });
    upsertLibraryCard(localStorage, card);
    queueCardSync(card);
    window.location.href = `/app/card/edit?id=${card.id}`;
  }

  function deleteActiveCard() {
    if (!window.confirm(`Delete “${profile.label}”? This cannot be undone.`)) return;
    const next = removeLibraryCard(localStorage, activeId);
    setCards(next);
    setViewingCard(false);
    window.history.replaceState(null, "", "/app/cards");
    if (next[0]) selectCard(next[0]);
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

  async function copySignature(format: "plain" | "html") {
    const email = profile.methods.find((method) => method.type === "email")?.value || profile.email;
    const phone = profile.methods.find((method) => method.type === "phone")?.value;
    const signatureProfile = {
      name: profile.name,
      role: profile.role,
      company: profile.company,
      cardUrl: shareUrl,
      showCompany: profile.showCompanyDetails !== false,
      photoUrl: profile.photo,
      email,
      phone,
      themeColor: profile.theme,
    };
    const payload = format === "plain"
      ? buildPlainSignature(signatureProfile)
      : buildHtmlSignature(signatureProfile);
    await navigator.clipboard.writeText(payload);
    setSignatureCopied(format);
    window.setTimeout(() => setSignatureCopied(""), 1400);
  }

  function openInApp() {
    window.location.href = `aftermeet://share-card?slug=${encodeURIComponent(profile.slug)}`;
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
      subtitle={`${cards.length} of ${MAX_CARDS} cards created`}
    >
      <div className="flow-page">
        {qrError && <StatusMessage tone="error">{qrError}</StatusMessage>}
        {!hydrated ? <PageSkeleton rows={3} /> : !cards.length ? (
          <section className="cards-empty-state">
            <div className="cards-empty-visual"><div><QrCodeIcon size={42} weight="bold" /></div><span><PlusIcon size={22} weight="bold" /></span></div>
            <span className="step-pill">Your first card</span>
            <h1>Create a card people can remember.</h1>
            <p>Add your identity and the ways people can reach you. AfterMeet creates the QR code when you save the card.</p>
            <Button onClick={() => createCard()}><PlusIcon size={18} weight="bold" /> Create your first card</Button>
            {isTeamWorkspace && templates.length ? (
              <div className="team-template-picker">
                <p>Or start from an org template:</p>
                <div className="team-template-picker-actions">
                  {templates.map((template) => (
                    <Button key={template.id} variant="secondary" onClick={() => createCardFromTemplate(template)}>
                      {template.name}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            <small>You can create up to five cards for different roles, businesses, or occasions.</small>
          </section>
        ) : !viewingCard ? (
          <>
            <div className="flow-heading"><div><h1>Choose a card to open.</h1><p>Open a card to see its details, QR code, sharing tools, and phone widget options.</p></div></div>
            <section className="card-library-overview" aria-label="Your cards">
              <header><div><h2>Your cards</h2><p>{cards.length} of {MAX_CARDS} created</p></div></header>
              <div className="card-overview-grid">
                {cards.map((card, index) => (
                  <article key={card.id} className="card-overview-item">
                    <button onClick={() => openCard(card)} type="button">
                      <div className="card-overview-cover" style={{ background: card.theme }}><span>{card.company[0] || card.name[0] || "A"}</span><QrCodeIcon size={22} weight="bold" /></div>
                      <div className="card-overview-copy"><small>Card {index + 1}</small><h3>{card.label || `Card ${index + 1}`}</h3><p>{card.name || "Finish setting up this card"}</p><strong>View card <ArrowSquareOutIcon size={15} weight="bold" /></strong></div>
                    </button>
                  </article>
                ))}
                {cards.length < MAX_CARDS && <button className="card-overview-add" onClick={() => createCard()} type="button"><span><PlusIcon size={24} weight="bold" /></span><strong>Create another card</strong><small>{MAX_CARDS - cards.length} remaining</small></button>}
              </div>
              {isTeamWorkspace && templates.length ? (
                <div className="team-template-picker">
                  <p>Create a member card from an org template:</p>
                  <div className="team-template-picker-actions">
                    {templates.map((template) => (
                      <Button key={template.id} variant="secondary" onClick={() => createCardFromTemplate(template)}>
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <>
            <div className="card-detail-topbar">
              <Button size="small" variant="ghost" onClick={showCardLibrary}><ArrowLeftIcon size={16} weight="bold" /> All cards</Button>
              <div><span>Viewing</span><strong>{profile.label}</strong></div>
              <div><LinkButton size="small" variant="secondary" href={`/app/card/edit?id=${activeId}`}><PencilSimpleIcon size={16} weight="bold" /> Edit card</LinkButton><Button size="small" variant="secondary" onClick={() => setShareModalOpen(true)}><UploadSimpleIcon size={16} weight="bold" /> Share card</Button><Button size="small" variant="ghost" onClick={deleteActiveCard}><TrashIcon size={16} /> Delete</Button></div>
            </div>
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
            <div className="inline-qr-head"><span><QrCodeIcon size={22} weight="bold" /></span><div><h2>Let someone scan this card</h2><p>They only need their phone camera—no app or account required.</p></div></div>
            <ol className="scan-steps">
              <li><span>1</span>Open the camera</li>
              <li><span>2</span>Point at the QR</li>
              <li><span>3</span>Open your card</li>
            </ol>
            {qr ? <div className="inline-qr-frame"><img className="inline-qr-image" src={qr} alt={`QR code for ${profile.name}'s card`} /></div> : !qrError && <div className="inline-qr-frame" aria-label="Generating QR code" aria-busy="true"><span className="skeleton qr-skeleton" /></div>}
            <div className="inline-qr-url"><span>Public card link</span><strong>{shareUrl}</strong></div>
            <div className="inline-qr-actions">
              <Button onClick={copyLink}><CopyIcon size={18} weight="bold" />{copied ? "Link copied" : "Copy link"}</Button>
              {qr && <LinkButton variant="secondary" href={qr} download="aftermeet-qr.png"><DownloadSimpleIcon size={18} weight="bold" />Download QR</LinkButton>}
            </div>
            <Button fullWidth size="small" variant="ghost" disabled={!qrSvg} onClick={copySvg}><CopyIcon size={16} weight="bold" />{svgCopied ? "SVG copied" : qrSvg ? "Copy QR as SVG" : "Generating QR…"}</Button>
            <section className="signature-panel">
              <div className="inline-qr-head"><span><EnvelopeSimpleIcon size={22} weight="bold" /></span><div><h2>Email signature</h2><p>Paste this into Gmail, Outlook, or Apple Mail so every email links back to your card.</p></div></div>
              <pre className="signature-preview">{buildPlainSignature({ name: profile.name, role: profile.role, company: profile.company, cardUrl: shareUrl })}</pre>
              <div className="inline-qr-actions">
                <Button variant="secondary" onClick={() => void copySignature("plain")}><CopyIcon size={18} weight="bold" />{signatureCopied === "plain" ? "Plain copied" : "Copy plain text"}</Button>
                <Button variant="secondary" onClick={() => void copySignature("html")}><CopyIcon size={18} weight="bold" />{signatureCopied === "html" ? "HTML copied" : "Copy HTML"}</Button>
              </div>
              <small className="signature-note">Use plain text for most clients. HTML keeps the card link clickable in Gmail and Outlook.</small>
            </section>
            <WalletSharePanel slug={profile.slug} shareUrl={shareUrl} />
            <section className="phone-widget-panel">
              <div className="phone-widget-head"><span><DeviceMobileIcon size={22} weight="bold" /></span><div><h3>Use this card from your phone</h3><p>Open it instantly from the AfterMeet app or your Home Screen widget.</p></div></div>
              <div className="phone-widget-actions">
                <Button onClick={openInApp}><DeviceMobileIcon size={17} weight="bold" /> Open in app</Button>
                <Button variant="secondary" aria-expanded={showWidgetHelp} onClick={() => setShowWidgetHelp((current) => !current)}>Add a widget {showWidgetHelp ? <CaretUpIcon /> : <CaretDownIcon />}</Button>
              </div>
              {showWidgetHelp && <div className="widget-instructions">
                <article><strong>iPhone or iPad</strong><p>Install and open AfterMeet once. Touch and hold the Home Screen, tap <b>Edit</b>, then <b>Add Widget</b>. Search for AfterMeet and choose Quick Share.</p></article>
                <article><strong>Android</strong><p>Install and open AfterMeet once. Touch and hold an empty part of the Home Screen, tap <b>Widgets</b>, then choose AfterMeet Quick Share.</p></article>
                <small>Apple and Android require widgets to be added from the device’s widget picker.</small>
              </div>}
            </section>
          </section>
            </div>
            <ShareCardModal
              open={shareModalOpen}
              onClose={() => setShareModalOpen(false)}
              cardName={profile.name}
              shareUrl={shareUrl}
              qrDataUrl={qr}
              copied={copied}
              onCopyLink={copyLink}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
