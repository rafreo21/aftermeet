import test from "node:test";
import assert from "node:assert/strict";

import {
  contactFromRow,
  contactMatchesLocal,
  contactToRow,
  isContactUuid,
} from "../lib/contacts-server.ts";

test("isContactUuid validates uuid contact ids", () => {
  assert.equal(isContactUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isContactUuid("exchange-550e8400-e29b-41d4-a716-446655440000"), false);
});

test("contactFromRow maps database columns to Contact", () => {
  const contact = contactFromRow({
    id: "550e8400-e29b-41d4-a716-446655440000",
    workspace_id: "ws",
    created_by_user_id: "user",
    first_name: "Sarah",
    last_name: "Chen",
    email: "sarah@example.com",
    phone: "+441234",
    linkedin_url: "https://linkedin.com/in/sarahchen",
    whatsapp_url: "447700900000",
    instagram_url: "sarahchen",
    x_url: "sarah_x",
    tiktok_url: "sarah.tiktok",
    company: "Acme",
    role: "Founder",
    context: "Met at summit",
    source: "exchange",
    exchange_id: "ex-1",
    campaign_id: "camp-1",
    legacy_id: "exchange-ex-1",
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
  });

  assert.equal(contact.firstName, "Sarah");
  assert.equal(contact.exchangeId, "ex-1");
  assert.equal(contact.phone, "+441234");
  assert.equal(contact.instagramUrl, "sarahchen");
});

test("contactToRow stores legacy id for non-uuid client ids", () => {
  const row = contactToRow(
    {
      id: "exchange-ex-1",
      firstName: "Sarah",
      lastName: "Chen",
      email: "sarah@example.com",
      whatsappUrl: "447700900000",
      instagramUrl: "sarahchen",
      xUrl: "sarah_x",
      tiktokUrl: "sarah.tiktok",
      company: "",
      role: "",
      context: "",
      source: "exchange",
      exchangeId: "ex-1",
    },
    "workspace-id",
    "user-id",
  );

  assert.equal(row.legacy_id, "exchange-ex-1");
  assert.equal(isContactUuid(row.id), true);
  assert.equal(row.exchange_id, "ex-1");
  assert.equal(row.whatsapp_url, "447700900000");
  assert.equal(row.instagram_url, "sarahchen");
});

test("contactMatchesLocal matches by id or exchange id", () => {
  const server = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    firstName: "Sarah",
    lastName: "Chen",
    email: "",
    company: "",
    role: "",
    context: "",
    exchangeId: "ex-1",
  };
  const local = {
    id: "exchange-ex-1",
    firstName: "Sarah",
    lastName: "Chen",
    email: "",
    company: "",
    role: "",
    context: "",
    exchangeId: "ex-1",
  };

  assert.equal(contactMatchesLocal(server, local), true);
});
