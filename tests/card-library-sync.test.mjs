import assert from "node:assert/strict";
import test from "node:test";

import { preserveLocalCardImages } from "../lib/card-library.ts";

const baseCard = {
  id: "card-1",
  slug: "personal",
  label: "Personal card",
  name: "Raphael Okojie",
  role: "",
  company: "",
  bio: "",
  theme: "#9fe870",
  photo: "",
  companyLogo: "",
  coverPhoto: "",
  methods: [],
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
};

test("preserves local images when the server copy is empty", () => {
  const result = preserveLocalCardImages(baseCard, {
    ...baseCard,
    photo: "data:image/png;base64,profile",
    coverPhoto: "data:image/jpeg;base64,cover",
    companyLogo: "data:image/png;base64,logo",
  });

  assert.equal(result.photo, "data:image/png;base64,profile");
  assert.equal(result.coverPhoto, "data:image/jpeg;base64,cover");
  assert.equal(result.companyLogo, "data:image/png;base64,logo");
});

test("keeps permanent server image URLs when they exist", () => {
  const result = preserveLocalCardImages({
    ...baseCard,
    photo: "https://cdn.example/profile.png",
    coverPhoto: "https://cdn.example/cover.jpg",
  }, {
    ...baseCard,
    photo: "data:image/png;base64,old-profile",
    coverPhoto: "data:image/jpeg;base64,old-cover",
  });

  assert.equal(result.photo, "https://cdn.example/profile.png");
  assert.equal(result.coverPhoto, "https://cdn.example/cover.jpg");
});
