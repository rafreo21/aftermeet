import { NextResponse } from "next/server";

import type { Contact } from "../../../../../lib/contacts";
import { isHubSpotConfigured, upsertHubSpotContact, type CrmSyncPayload } from "../../../../../lib/crm/hubspot";
import type { Encounter } from "../../../../../lib/encounters";
import { getAppUser } from "../../../../../lib/auth/context";

function isContact(value: unknown): value is Contact {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.firstName === "string";
}

function isEncounter(value: unknown): value is Encounter {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.personName === "string";
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  if (!isHubSpotConfigured()) {
    return NextResponse.json({
      configured: false,
      error: "HubSpot is not configured for this environment.",
      setup: ["HUBSPOT_ACCESS_TOKEN"],
    }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as {
    contact?: unknown;
    encounters?: unknown;
  } | null;

  if (!body?.contact || !isContact(body.contact)) {
    return NextResponse.json({ error: "A valid contact is required." }, { status: 400 });
  }

  const encounters = Array.isArray(body.encounters)
    ? body.encounters.filter(isEncounter)
    : [];

  const payload: CrmSyncPayload = {
    contact: body.contact,
    encounters,
  };

  if (!payload.contact.firstName.trim()) {
    return NextResponse.json({ error: "Add a full name before syncing." }, { status: 400 });
  }

  try {
    const result = await upsertHubSpotContact(payload);
    return NextResponse.json({
      ok: true,
      provider: "hubspot",
      externalId: result.contactId,
      syncedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "We couldn’t sync this contact to HubSpot.",
    }, { status: 500 });
  }
}
