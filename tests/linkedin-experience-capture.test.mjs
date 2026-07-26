import test from "node:test";
import assert from "node:assert/strict";

import {
  captureExperienceFromSection,
  isValidExperienceCompany,
  isValidExperienceRole,
  parseExperienceSectionText,
  sanitizeExperienceRoleCompany,
} from "../lib/linkedin-experience-capture.ts";
import { LINKEDIN_PROFILE_FIXTURE, parseExperienceFromText } from "../lib/linkedin-page-capture.ts";

test("parseExperienceSectionText reads first job under Experience", () => {
  assert.deepEqual(parseExperienceFromText(LINKEDIN_PROFILE_FIXTURE), {
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});

test("sanitizeExperienceRoleCompany rejects badge and bio junk", () => {
  assert.deepEqual(
    sanitizeExperienceRoleCompany({
      role: "UK Global Talent",
      company: "Product Designer - I manage, lead and design simple solutions",
    }),
    { role: "", company: "" },
  );
});

test("isValidExperienceRole accepts real job titles", () => {
  assert.equal(isValidExperienceRole("Product Designer"), true);
  assert.equal(isValidExperienceRole("UK Global Talent"), false);
});

test("isValidExperienceCompany accepts employer names", () => {
  assert.equal(isValidExperienceCompany("Nexleaf Analytics"), true);
  assert.equal(isValidExperienceCompany("Product Designer - I manage, lead"), false);
});

test("captureExperienceFromSection reads structured list items", () => {
  const section = {
    innerText: "Experience\nProduct Designer\nNexleaf Analytics · Full-time",
    querySelectorAll(selector) {
      if (selector.includes("li")) {
        return [{
          querySelector(innerSelector) {
            if (innerSelector.includes("aria-hidden")) return { textContent: "Product Designer" };
            if (innerSelector.includes("t-14")) return { textContent: "Nexleaf Analytics · Full-time" };
            return null;
          },
          querySelectorAll(innerSelector) {
            if (innerSelector.includes("aria-hidden")) {
              return [
                { textContent: "Product Designer" },
                { textContent: "Nexleaf Analytics · Full-time" },
              ];
            }
            return [];
          },
        }];
      }
      return [];
    },
  };

  assert.deepEqual(captureExperienceFromSection(section), {
    role: "Product Designer",
    company: "Nexleaf Analytics",
  });
});
