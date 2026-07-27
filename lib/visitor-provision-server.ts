import "server-only";

import { createServiceSupabaseClient } from "./supabase/service";

export async function provisionVisitorFromExchange(params: {
  email: string;
  displayName: string;
  exchangeId: string;
}) {
  const admin = createServiceSupabaseClient();
  if (!admin) return { ok: false as const, reason: "service_unavailable" };

  const email = params.email.trim().toLowerCase();
  const displayName = params.displayName.trim();
  if (!email || !displayName) return { ok: false as const, reason: "invalid_input" };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      signup_intent: "visitor",
      pending_exchange_id: params.exchangeId,
    },
  });

  if (!createError && created.user) {
    return { ok: true as const, created: true };
  }

  const message = createError.message.toLowerCase();
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
    const authUserId = await findAuthUserIdByEmail(admin, email);
    if (authUserId) {
      await admin.auth.admin.updateUserById(authUserId, {
        user_metadata: {
          display_name: displayName,
          signup_intent: "visitor",
          pending_exchange_id: params.exchangeId,
        },
      });
    }
    return { ok: true as const, created: false };
  }

  return { ok: false as const, reason: createError.message };
}

async function findAuthUserIdByEmail(
  admin: NonNullable<ReturnType<typeof createServiceSupabaseClient>>,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data.users.length) break;
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match.id;
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}
