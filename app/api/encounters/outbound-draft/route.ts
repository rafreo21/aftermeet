import { NextResponse } from "next/server";

import { buildActionLinkContext } from "../../../../lib/action-links";
import type { Contact } from "../../../../lib/contacts";
import type { Encounter, EncounterAction } from "../../../../lib/encounters";
import { resolveApiUser } from "../../../../lib/auth/api-request";
import { generateOutboundDraft } from "../../../../lib/outbound-draft-server";
import { supportsOutboundDraft } from "../../../../lib/outbound-habit";

function isEncounter(value: unknown): value is Encounter {
  if (!value || typeof value !== "object") return false;
  return typeof (value as Encounter).id === "string";
}

function isAction(value: unknown): value is EncounterAction {
  if (!value || typeof value !== "object") return false;
  return typeof (value as EncounterAction).id === "string" && typeof (value as EncounterAction).title === "string";
}

function isContact(value: unknown): value is Contact {
  if (!value || typeof value !== "object") return false;
  return typeof (value as Contact).id === "string";
}

export async function POST(request: Request) {
  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    encounter?: unknown;
    action?: unknown;
    contact?: unknown;
  } | null;

  if (!body?.encounter || !isEncounter(body.encounter) || !body?.action || !isAction(body.action)) {
    return NextResponse.json({ error: "A valid encounter action is required." }, { status: 400 });
  }

  if (!supportsOutboundDraft(body.action.channel)) {
    return NextResponse.json({ error: "This action type does not support outbound drafts." }, { status: 400 });
  }

  const contact = body.contact && isContact(body.contact) ? body.contact : null;
  const context = buildActionLinkContext(body.encounter, contact);

  try {
    const result = await generateOutboundDraft({
      action: body.action,
      encounter: body.encounter,
      context,
    });

    return NextResponse.json({
      draft: result.draft,
      source: result.source,
      fallback: result.fallback ?? false,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "We couldn’t draft this message.",
    }, { status: 500 });
  }
}
