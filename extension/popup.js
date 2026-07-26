const baseUrlInput = document.getElementById("base-url");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const captureButton = document.getElementById("capture");

function encodePayload(profile) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(profile))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function renderPreview(profile) {
  const lines = [
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Unknown name",
    [profile.role, profile.company].filter(Boolean).join(" · "),
    profile.email,
    profile.phone,
    profile.linkedinUrl,
  ].filter(Boolean);
  preview.textContent = lines.length ? lines.join("\n") : "No profile details found on this page.";
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(["aftermeetBaseUrl"]);
  baseUrlInput.value = stored.aftermeetBaseUrl || "http://localhost:3000";
}

async function saveSettings() {
  await chrome.storage.sync.set({ aftermeetBaseUrl: baseUrlInput.value.trim() || "http://localhost:3000" });
}

async function captureActiveTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "aftermeet-capture" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["linkedin-voyager.js", "capture-profile.js"],
    });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => await window.aftermeetCapturePage(),
    });
    return result;
  }
}

async function enrichProfile(baseUrl, profile, pageText) {
  if (profile.role?.trim() && profile.company?.trim()) {
    return { profile, message: "Captured role and company from LinkedIn." };
  }

  try {
    const response = await fetch(`${baseUrl}/api/contacts/capture`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, pageText }),
    });
    if (!response.ok) return { profile, message: "" };
    const payload = await response.json();
    if (!payload?.profile) return { profile, message: "" };

    const merged = { ...profile };
    for (const field of ["firstName", "lastName", "email", "phone", "role", "company", "context"]) {
      const next = payload.profile[field]?.trim?.() ?? "";
      const prev = profile[field]?.trim?.() ?? "";
      if (next) merged[field] = payload.profile[field];
      else if (prev) merged[field] = profile[field];
    }
    merged.linkedinUrl = profile.linkedinUrl || payload.profile.linkedinUrl || "";
    merged.sourceUrl = profile.sourceUrl || payload.profile.sourceUrl || "";
    merged.source = "extension";

    return {
      profile: merged,
      message: typeof payload.message === "string" ? payload.message : "Cleaned captured profile details.",
    };
  } catch {
    return { profile, message: "" };
  }
}

captureButton.addEventListener("click", async () => {
  status.textContent = "Fetching experience from LinkedIn…";
  await saveSettings();
  const baseUrl = baseUrlInput.value.trim().replace(/\/+$/, "") || "http://localhost:3000";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    status.textContent = "No active tab found.";
    return;
  }

  let payload;
  try {
    payload = await captureActiveTab(tab.id);
  } catch {
    status.textContent = "Could not read this page.";
    return;
  }

  const profile = payload?.profile;
  if (!profile) {
    status.textContent = "Could not read this page.";
    return;
  }

  renderPreview(profile);
  status.textContent = "Cleaning captured details…";

  const enriched = await enrichProfile(baseUrl, profile, payload.pageText ?? "");
  renderPreview(enriched.profile);

  const target = new URL("/app/contacts/linkedin", baseUrl);
  if (enriched.profile.linkedinUrl || enriched.profile.sourceUrl) {
    target.searchParams.set("url", enriched.profile.linkedinUrl || enriched.profile.sourceUrl);
  }
  target.searchParams.set("capture", encodePayload(enriched.profile));
  target.searchParams.set("source", "extension");
  chrome.tabs.create({ url: target.toString() });
  status.textContent = enriched.message || "Opened AfterMeet for review.";
});

baseUrlInput.addEventListener("change", saveSettings);
void loadSettings();
