import assert from "node:assert/strict";
import test from "node:test";

import { dispatchPushForUser } from "../lib/push-dispatch-server.ts";

function fakeSupabase(tokens) {
  const updates = [];
  return {
    updates,
    from(table) {
      return {
        select() {
          return {
            eq() {
              return {
                is() {
                  return Promise.resolve({ data: tokens, error: null });
                },
              };
            },
          };
        },
        update(patch) {
          return {
            eq(column, value) {
              updates.push({ table, patch, match: { [column]: value } });
              return Promise.resolve({ error: null });
            },
            in(column, values) {
              updates.push({ table, patch, match: { [column]: values } });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve(run()).finally(() => {
    globalThis.fetch = original;
  });
}

test("dispatchPushForUser does nothing when the user has no active tokens", async () => {
  const supabase = fakeSupabase([]);
  let fetchCalled = false;
  await withFetch(() => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  }, () => dispatchPushForUser(supabase, {
    userId: "user-1",
    type: "review_ready",
    title: "Ready to review",
    encounterId: "encounter-1",
  }));

  assert.equal(fetchCalled, false);
  assert.equal(supabase.updates.length, 0);
});

test("dispatchPushForUser records a successful delivery per token", async () => {
  const tokens = [{ id: "token-1", expo_push_token: "ExponentPushToken[aaa]" }];
  const supabase = fakeSupabase(tokens);

  let sentBody = null;
  await withFetch(async (url, init) => {
    sentBody = JSON.parse(init.body);
    return {
      json: async () => ({ data: [{ status: "ok" }] }),
    };
  }, () => dispatchPushForUser(supabase, {
    userId: "user-1",
    type: "follow_up_due",
    title: "Due today: Send the proposal",
    body: "With Sarah Chen",
    encounterId: "encounter-1",
    actionId: "action-1",
  }));

  assert.equal(sentBody[0].to, "ExponentPushToken[aaa]");
  assert.equal(sentBody[0].data.type, "follow_up_due");
  assert.equal(sentBody[0].data.route, "/capture/encounter-1");
  assert.equal(sentBody[0].data.actionId, "action-1");

  const update = supabase.updates.find((entry) => entry.match.id === "token-1");
  assert.equal(update.patch.last_delivery_status, "ok");
});

test("dispatchPushForUser deactivates a token Expo reports as DeviceNotRegistered", async () => {
  const tokens = [{ id: "token-2", expo_push_token: "ExponentPushToken[bbb]" }];
  const supabase = fakeSupabase(tokens);

  await withFetch(async () => ({
    json: async () => ({
      data: [{ status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } }],
    }),
  }), () => dispatchPushForUser(supabase, {
    userId: "user-1",
    type: "review_ready",
    title: "Ready to review",
    encounterId: "encounter-1",
  }));

  const update = supabase.updates.find((entry) => entry.match.id === "token-2");
  assert.equal(update.patch.last_delivery_status, "error");
  assert.ok(update.patch.disabled_at);
});

test("dispatchPushForUser keeps a token active for a non-fatal delivery error", async () => {
  const tokens = [{ id: "token-3", expo_push_token: "ExponentPushToken[ccc]" }];
  const supabase = fakeSupabase(tokens);

  await withFetch(async () => ({
    json: async () => ({
      data: [{ status: "error", message: "rate limited", details: { error: "MessageRateExceeded" } }],
    }),
  }), () => dispatchPushForUser(supabase, {
    userId: "user-1",
    type: "review_ready",
    title: "Ready to review",
    encounterId: "encounter-1",
  }));

  const update = supabase.updates.find((entry) => entry.match.id === "token-3");
  assert.equal(update.patch.last_delivery_status, "error");
  assert.equal(update.patch.disabled_at, undefined);
});

test("dispatchPushForUser never throws when the network request fails", async () => {
  const tokens = [{ id: "token-4", expo_push_token: "ExponentPushToken[ddd]" }];
  const supabase = fakeSupabase(tokens);

  await assert.doesNotReject(() => withFetch(async () => {
    throw new Error("network down");
  }, () => dispatchPushForUser(supabase, {
    userId: "user-1",
    type: "review_ready",
    title: "Ready to review",
    encounterId: "encounter-1",
  })));

  // A network-level failure updates every token in the batch at once via .in(),
  // rather than per-token via .eq() like the ticket-level branch does.
  const update = supabase.updates.find((entry) => Array.isArray(entry.match.id) && entry.match.id.includes("token-4"));
  assert.equal(update.patch.last_delivery_status, "error");
});

test("dispatchPushForUser omits the route when no encounter is attached", async () => {
  const tokens = [{ id: "token-5", expo_push_token: "ExponentPushToken[eee]" }];
  const supabase = fakeSupabase(tokens);

  let sentBody = null;
  await withFetch(async (url, init) => {
    sentBody = JSON.parse(init.body);
    return { json: async () => ({ data: [{ status: "ok" }] }) };
  }, () => dispatchPushForUser(supabase, {
    userId: "user-1",
    type: "shared_meeting_update",
    title: "Update",
  }));

  assert.equal(sentBody[0].data.route, null);
});
