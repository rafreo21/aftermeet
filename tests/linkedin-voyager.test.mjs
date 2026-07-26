import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTACT_INFO_FIXTURE,
  DASH_TOP_CARD_FIXTURE,
  EXPERIENCE_GRAPHQL_FIXTURE,
  mergeVoyagerIntoProfile,
  parseContactInfoResponse,
  parseDashTopCardResponse,
  parseEmbeddedLinkedInSnapshot,
  parseExperienceGraphqlResponse,
  parseLinkedInPublicId,
  parseProfileViewResponse,
  PROFILE_VIEW_FIXTURE,
} from "../lib/linkedin-voyager.ts";

test("parseLinkedInPublicId extracts profile handle from URL", () => {
  assert.equal(parseLinkedInPublicId("https://www.linkedin.com/in/rafreo/"), "rafreo");
});

test("parseProfileViewResponse reads current job from positionView", () => {
  assert.deepEqual(parseProfileViewResponse(PROFILE_VIEW_FIXTURE), {
    firstName: "Raphael",
    lastName: "Okojie",
    publicId: "rafreo",
    urnId: "ACoAAB123",
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});

test("parseContactInfoResponse reads email and phone", () => {
  assert.deepEqual(parseContactInfoResponse(CONTACT_INFO_FIXTURE), {
    email: "rafreo21@gmail.com",
    phone: "+447473177720",
    companyWebsite: "",
    personalWebsite: "",
  });
});

test("parseDashTopCardResponse reads headline role and company", () => {
  assert.deepEqual(parseDashTopCardResponse(DASH_TOP_CARD_FIXTURE), {
    firstName: "Raphael",
    lastName: "Okojie",
    urnId: "ACoAAB123",
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});

test("parseEmbeddedLinkedInSnapshot reads headline and contact info", () => {
  const snapshot = JSON.stringify({
    profile: { headline: "Product Designer at Nexleaf Analytics" },
    emailAddress: "rafreo21@gmail.com",
    phoneNumbers: [{ number: "+447473177720" }],
  });
  const parsed = parseEmbeddedLinkedInSnapshot(snapshot);
  assert.equal(parsed.role, "Product Designer");
  assert.equal(parsed.company, "Nexleaf Analytics");
  assert.equal(parsed.email, "rafreo21@gmail.com");
  assert.equal(parsed.phone, "+447473177720");
});

test("parseExperienceGraphqlResponse reads current job from dash GraphQL", () => {
  assert.deepEqual(parseExperienceGraphqlResponse(EXPERIENCE_GRAPHQL_FIXTURE), {
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});

test("mergeVoyagerIntoProfile prefers structured API values", () => {
  const merged = mergeVoyagerIntoProfile(
    {
      firstName: "Raphael",
      lastName: "Okojie",
      role: "UK Global Talent",
      company: "Product Designer - I manage, lead and design",
      email: "",
      phone: "",
    },
    {
      ...parseProfileViewResponse(PROFILE_VIEW_FIXTURE),
      ...parseContactInfoResponse(CONTACT_INFO_FIXTURE),
    },
  );

  assert.equal(merged.role, "Product Designer");
  assert.equal(merged.company, "Nexleaf Analytics");
  assert.equal(merged.email, "rafreo21@gmail.com");
  assert.equal(merged.phone, "+447473177720");
});
