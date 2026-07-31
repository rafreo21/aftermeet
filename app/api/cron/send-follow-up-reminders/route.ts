import { NextResponse } from "next/server";

import { encounterFromApi } from "../../../../lib/encounters";
import { fetchParticipantsByEncounter } from "../../../../lib/encounter-participants-server";
import { flattenOpenFollowUps, type FollowUpItem } from "../../../../lib/follow-ups-server";
import { buildReminderDigestEmail, reminderQualifies } from "../../../../lib/reminder-email";
import { sendEmail } from "../../../../lib/send-email";
import { createServiceSupabaseClient } from "../../../../lib/supabase/service";

type ReminderUser = {
  id: string;
  auth_user_id: string;
  primary_email: string;
  status: string;
};

function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabaseClient();
  if (!service) {
    return NextResponse.json({ error: "Service client is not configured." }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://aftermeet.app";
  const todayStart = startOfTodayIso();

  const { data: users, error: usersError } = await service
    .from("users")
    .select("id, auth_user_id, primary_email, status")
    .eq("status", "active")
    .eq("reminder_emails_enabled", true)
    .or(`reminder_last_sent_at.is.null,reminder_last_sent_at.lt.${todayStart}`)
    .limit(500);

  if (usersError) {
    return NextResponse.json({ error: "Could not load reminder recipients." }, { status: 500 });
  }

  let scanned = 0;
  let sent = 0;
  let failed = 0;

  for (const user of (users ?? []) as ReminderUser[]) {
    scanned += 1;
    if (!user.primary_email?.trim()) continue;

    const qualifying: FollowUpItem[] = [];

    const { data: membership } = await service
      .from("workspace_memberships")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (membership?.workspace_id) {
      const { data: ownEncounters } = await service
        .from("encounters")
        .select("*")
        .eq("workspace_id", membership.workspace_id)
        .limit(250);

      if (ownEncounters?.length) {
        const encounterIds = ownEncounters.map((row) => row.id as string);
        const participantsByEncounter = await fetchParticipantsByEncounter(service, encounterIds);
        const encounters = ownEncounters.map((row) => encounterFromApi({
          ...row,
          participants: participantsByEncounter.get(row.id as string) ?? [],
        }));

        for (const item of flattenOpenFollowUps(encounters)) {
          if (item.owner === "me" && reminderQualifies(item)) qualifying.push(item);
        }
      }
    }

    const { data: claimedParticipants } = await service
      .from("encounter_participants")
      .select("id, encounter_id")
      .eq("claimed_by_user_id", user.id);

    if (claimedParticipants?.length) {
      const claimedEncounterIds = claimedParticipants.map((row) => row.encounter_id as string);
      const { data: claimedEncounters } = await service
        .from("encounters")
        .select("*")
        .in("id", claimedEncounterIds);

      if (claimedEncounters?.length) {
        const participantIdByEncounter = new Map(
          claimedParticipants.map((row) => [row.encounter_id as string, row.id as string]),
        );
        const encounters = claimedEncounters.map((row) => encounterFromApi({ ...row, participants: [] }));

        for (const item of flattenOpenFollowUps(encounters)) {
          const myParticipantId = participantIdByEncounter.get(item.encounterId);
          if (item.owner === "guest" && item.participantId === myParticipantId && reminderQualifies(item)) {
            qualifying.push(item);
          }
        }
      }
    }

    if (!qualifying.length) continue;

    const { subject, html } = buildReminderDigestEmail(qualifying, appUrl);
    const result = await sendEmail({ to: user.primary_email.trim(), subject, html });

    if (result.ok) {
      sent += 1;
      await service
        .from("users")
        .update({ reminder_last_sent_at: new Date().toISOString() })
        .eq("id", user.id);
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, scanned, sent, failed });
}
