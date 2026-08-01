import { NextResponse } from "next/server";

import { createApiSupabaseClient, resolveApiUser } from "../../../../../../lib/auth/api-request";
import { encounterFromApi, normalizeEncounterActions, type EncounterAction } from "../../../../../../lib/encounters";
import { fetchParticipantsByEncounter } from "../../../../../../lib/encounter-participants-server";

const allowedStatuses = new Set(["open", "completed", "snoozed"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; actionId: string }> },
) {
  const { id, actionId } = await context.params;
  const body = await request.json().catch(() => null) as { status?: string; action?: EncounterAction } | null;
  const status = body?.status?.trim();

  if (!body) {
    return NextResponse.json({ error: "A valid action update is required." }, { status: 400 });
  }
  if (!body?.action && (!status || !allowedStatuses.has(status))) {
    return NextResponse.json({ error: "A valid action update is required." }, { status: 400 });
  }
  if (body.action && (body.action.id !== actionId || !allowedStatuses.has(body.action.status))) {
    return NextResponse.json({ error: "The follow-up update is invalid." }, { status: 400 });
  }

  const user = await resolveApiUser(request);
  if (!user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  if (user.id === "local-development-preview") {
    return NextResponse.json({ ok: true, preview: true });
  }

  const supabase = await createApiSupabaseClient(request);
  const { data, error } = await supabase
    .from("encounters")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", user.workspaceId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Encounter not found." }, { status: 404 });
  }

  const actions = Array.isArray(data.actions) ? data.actions as EncounterAction[] : [];
  const index = actions.findIndex((action) => action.id === actionId);
  if (index < 0) {
    return NextResponse.json({ error: "Follow-up not found." }, { status: 404 });
  }

  const mergedActions = actions.map((action, actionIndex) => (
    actionIndex === index
      ? body.action
        ? {
            ...action,
            ...body.action,
            id: action.id,
            completedAt: body.action.status === "completed"
              ? body.action.completedAt || action.completedAt || new Date().toISOString()
              : undefined,
          }
        : {
            ...action,
            status,
            completedAt: status === "completed"
              ? action.completedAt || new Date().toISOString()
              : undefined,
          }
      : action
  ));
  const participants = (await fetchParticipantsByEncounter(supabase, [id])).get(id) ?? [];
  const nextActions = normalizeEncounterActions(mergedActions, participants, {
    name: typeof data.person_name === "string" ? data.person_name : "",
    email: typeof data.person_email === "string" ? data.person_email : "",
  });

  const { error: updateError } = await supabase
    .from("encounters")
    .update({ actions: nextActions, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", user.workspaceId);

  if (updateError) {
    return NextResponse.json({ error: "Could not update this follow-up." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    encounter: encounterFromApi({ ...data, actions: nextActions, participants }),
  });
}
