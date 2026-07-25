import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  EnvelopeSimple,
  Globe,
  LinkSimple,
  MapPin,
  Phone,
} from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";

import { contactMethodHref } from "@/lib/contact-methods";
import "./public-card.css";

type Params = Promise<{ slug: string }>;

async function getCard(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase
    .from("cards")
    .select("*, card_methods(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const card = await getCard(slug);
  return card
    ? {
        title: `${card.full_name} · AfterMeet`,
        description: [card.job_title, card.company].filter(Boolean).join(" at "),
      }
    : { title: "Contact card · AfterMeet" };
}

function MethodIcon({ type }: { type: string }) {
  if (type === "email") return <EnvelopeSimple aria-hidden size={21} />;
  if (type === "phone" || type === "whatsapp") return <Phone aria-hidden size={21} />;
  if (type === "address") return <MapPin aria-hidden size={21} />;
  if (type === "website") return <Globe aria-hidden size={21} />;
  return <LinkSimple aria-hidden size={21} />;
}

export default async function PublicCardPage({ params }: { params: Params }) {
  const { slug } = await params;
  const card = await getCard(slug);
  if (!card) notFound();
  const methods = [...(card.card_methods || [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const email = methods.find((method) => method.method_type === "email")?.value || "";
  const phone = methods.find((method) => method.method_type === "phone")?.value || "";
  const website = methods.find((method) => method.method_type === "website")?.value || "";
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${card.full_name}`,
    card.job_title ? `TITLE:${card.job_title}` : "",
    card.company ? `ORG:${card.company}` : "",
    email ? `EMAIL:${email}` : "",
    phone ? `TEL:${phone}` : "",
    website ? `URL:${website}` : "",
    "END:VCARD",
  ].filter(Boolean).join("\n");

  return (
    <main
      className="public-card-page"
      style={{ "--card-accent": card.theme_color } as CSSProperties}
    >
      <section className="public-card-shell">
        <div className="public-card-cover">
          {card.cover_image_url ? <img src={card.cover_image_url} alt="" /> : null}
        </div>
        <div className="public-card-content">
          <div className="public-card-avatar">
            {card.profile_image_url ? (
              <img src={card.profile_image_url} alt={card.full_name} />
            ) : (
              <span>
                {card.full_name
                  .split(/\s+/)
                  .map((part: string) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            )}
          </div>
          <p className="public-card-brand">AFTERMEET</p>
          <h1>{card.full_name}</h1>
          <p className="public-card-role">
            {[card.job_title, card.company].filter(Boolean).join(" · ")}
          </p>
          {card.bio ? <p className="public-card-bio">{card.bio}</p> : null}
          <div className="public-card-methods">
            {methods.map((method) => {
              const href = contactMethodHref({
                type: method.method_type,
                value: method.value,
              });
              if (!href) return null;
              return (
                <a
                  key={method.id}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                >
                  <MethodIcon type={method.method_type} />
                  <span>
                    <strong>{method.label || method.method_type}</strong>
                    <small>{method.value}</small>
                  </span>
                </a>
              );
            })}
          </div>
          <a
            className="public-card-return"
            download={`${slug}.vcf`}
            href={`data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`}
          >
            Save to contacts
          </a>
          <p className="public-card-private">
            Save this card now. AfterMeet never exposes private meeting notes here.
          </p>
        </div>
      </section>
    </main>
  );
}
