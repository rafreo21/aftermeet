import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { PublicCardFlow } from "./PublicCardFlow";
import "./public-card.css";

type Params = Promise<{ slug: string }>;

async function getCard(slug: string) {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
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

export default async function PublicCardPage({ params }: { params: Params }) {
  const { slug } = await params;
  const card = await getCard(slug);
  if (!card) notFound();
  const methods = [...(card.card_methods || [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
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
          <PublicCardFlow
            slug={slug}
            ownerName={card.full_name}
            jobTitle={card.job_title}
            company={card.company}
            bio={card.bio}
            methods={methods}
          />
        </div>
      </section>
    </main>
  );
}
