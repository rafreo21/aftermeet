import test from "node:test";
import assert from "node:assert/strict";

import { applyCardTemplate, buildCardFromTemplate, defaultTeamTemplateSeed } from "../lib/card-templates.ts";
import { canManageTemplates, cardTemplateFromRow } from "../lib/workspace/server.ts";

test("applyCardTemplate seeds a member card from org defaults", () => {
  const template = {
    ...defaultTeamTemplateSeed("Northstar Advisory"),
    id: "template-1",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
  };

  const card = buildCardFromTemplate(template, {
    memberName: "Alex Morgan",
    memberEmail: "alex@northstar.example",
    label: "Consulting card",
  }, {
    id: "card-1",
    slug: "alex-morgan",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
  });

  assert.equal(card.company, "Northstar Advisory");
  assert.equal(card.name, "Alex Morgan");
  assert.equal(card.methods.find((method) => method.type === "email")?.value, "alex@northstar.example");
});

test("applyCardTemplate generates identity fields", () => {
  const template = {
    ...defaultTeamTemplateSeed("Northstar Advisory"),
    id: "template-1",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
  const card = applyCardTemplate(template, { memberName: "Alex Morgan" });
  assert.ok(card.id);
  assert.ok(card.slug.startsWith("card-"));
});

test("cardTemplateFromRow maps stored template fields", () => {
  const template = cardTemplateFromRow({
    id: "template-1",
    name: "Field team card",
    company: "Northstar",
    theme_color: "#9FE870",
    company_logo_url: "logo.png",
    cover_image_url: "cover.png",
    bio_template: "Meet the team.",
    default_methods: [{ type: "website", value: "https://northstar.example", label: "Site" }],
    created_at: "2026-07-26T00:00:00.000Z",
    updated_at: "2026-07-26T00:00:00.000Z",
  });

  assert.equal(template.theme, "#9FE870");
  assert.equal(template.defaultMethods[0]?.value, "https://northstar.example");
});

test("canManageTemplates allows owner and admin roles only", () => {
  assert.equal(canManageTemplates("owner"), true);
  assert.equal(canManageTemplates("admin"), true);
  assert.equal(canManageTemplates("member"), false);
});
