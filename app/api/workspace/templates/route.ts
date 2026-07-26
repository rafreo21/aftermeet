import { NextResponse } from "next/server";

import { getAppUser } from "../../../../lib/auth/context";
import { defaultTeamTemplateSeed } from "../../../../lib/card-templates";
import { createClient } from "../../../../lib/supabase/server";
import {
  canManageTemplates,
  cardTemplateFromRow,
  cardTemplateToRow,
  type CardTemplateRow,
} from "../../../../lib/workspace/server";
import type { CardTemplate } from "../../../../lib/workspace/types";

const themePattern = /^#[0-9A-Fa-f]{6}$/;

function isTemplateBody(value: unknown): value is Omit<CardTemplate, "id" | "createdAt" | "updatedAt"> {
  if (!value || typeof value !== "object") return false;
  const template = value as CardTemplate;
  return typeof template.name === "string" && typeof template.theme === "string";
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (!canManageTemplates(user.workspaceRole)) {
    return NextResponse.json({ templates: [] }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (user.id === "local-development-preview") {
    return NextResponse.json({ templates: [], preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("card_templates")
    .select("*")
    .eq("workspace_id", user.workspaceId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "We couldn’t load card templates." }, { status: 500 });
  }

  return NextResponse.json({
    templates: ((data ?? []) as CardTemplateRow[]).map(cardTemplateFromRow),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (!canManageTemplates(user.workspaceRole)) {
    return NextResponse.json({ error: "Only workspace admins can create templates." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const template = isTemplateBody(body)
    ? body
    : defaultTeamTemplateSeed(typeof body === "object" && body && "company" in body ? String((body as { company?: string }).company || "Your team") : "Your team");

  if (template.name.trim().length < 2 || !themePattern.test(template.theme)) {
    return NextResponse.json({ error: "Add a template name and valid theme color." }, { status: 400 });
  }

  if (user.id === "local-development-preview") {
    return NextResponse.json({ template, preview: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createClient();
  const row = cardTemplateToRow(template, user.workspaceId, user.id);
  const { data, error } = await supabase
    .from("card_templates")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "We couldn’t save this template." }, { status: 500 });
  }

  return NextResponse.json({
    template: cardTemplateFromRow(data as CardTemplateRow),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
