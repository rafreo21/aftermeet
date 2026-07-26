import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTACT_INFO_FIXTURE,
  EXPERIENCE_GRAPHQL_FIXTURE,
  mergeVoyagerIntoProfile,
  parseContactInfoResponse,
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
