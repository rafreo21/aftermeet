import assert from "node:assert/strict";
import test from "node:test";

import {
  createNotification,
  mapNotificationRow,
  notificationTypeEnabled,
} from "../lib/notifications-server.ts";

function fakeSupabase(result) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        insert(row) {
          calls.push({ table, row });
          return Promise.resolve(result);
        },
      };
    },
  };
}

test("notificationTypeEnabled defaults to enabled for an unset or missing preference", () => {
  assert.equal(notificationTypeEnabled(null, "review_ready"), true);
  assert.equal(notificationTypeEnabled(undefined, "review_ready"), true);
  assert.equal(notificationTypeEnabled({}, "review_ready"), true);
  assert.equal(notificationTypeEnabled({ follow_up_due: false }, "review_ready"), true);
});

test("notificationTypeEnabled respects an explicit false", () => {
  assert.equal(notificationTypeEnabled({ follow_up_due: false }, "follow_up_due"), false);
  assert.equal(notificationTypeEnabled({ follow_up_due: true }, "follow_up_due"), true);
});

test("createNotification inserts a row scoped to the target user and event", async () => {
  const supabase = fakeSupabase({ error: null });
  const created = await createNotification(supabase, {
    userId: "user-1",
    workspaceId: "workspace-1",
    type: "review_ready",
    title: "Ready to review: Sarah Chen",
    encounterId: "encounter-1",
    dedupeKey: "review_ready:encounter-1",
  });

  assert.equal(created, true);
  assert.equal(supabase.calls.length, 1);
  assert.equal(supabase.calls[0].table, "notifications");
  assert.equal(supabase.calls[0].row.user_id, "user-1");
  assert.equal(supabase.calls[0].row.dedupe_key, "review_ready:encounter-1");
});

test("createNotification treats a unique-constraint violation as an expected duplicate, not an error", async () => {
  const supabase = fakeSupabase({ error: { code: "23505", message: "duplicate key" } });
  const created = await createNotification(supabase, {
    userId: "user-1",
    workspaceId: "workspace-1",
    type: "review_ready",
    title: "Ready to review",
    dedupeKey: "review_ready:encounter-1",
  });

  assert.equal(created, false);
});

test("createNotification rethrows a non-duplicate database error", async () => {
  const supabase = fakeSupabase({ error: { code: "42501", message: "permission denied" } });
  await assert.rejects(() => createNotification(supabase, {
    userId: "user-1",
    workspaceId: "workspace-1",
    type: "review_ready",
    title: "Ready to review",
    dedupeKey: "review_ready:encounter-1",
  }));
});

test("mapNotificationRow maps a database row into the shared shape", () => {
  const mapped = mapNotificationRow({
    id: "row-1",
    type: "follow_up_overdue",
    title: "Overdue: Send the proposal",
    body: "With Sarah Chen",
    encounter_id: "encounter-1",
    action_id: "action-1",
    read_at: null,
    created_at: "2026-08-03T09:00:00.000Z",
  });

  assert.deepEqual(mapped, {
    id: "row-1",
    type: "follow_up_overdue",
    title: "Overdue: Send the proposal",
    body: "With Sarah Chen",
    encounterId: "encounter-1",
    actionId: "action-1",
    readAt: null,
    createdAt: "2026-08-03T09:00:00.000Z",
  });
});
