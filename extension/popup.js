const baseUrlInput = document.getElementById("base-url");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const captureButton = document.getElementById("capture");
const openAfterMeetButton = document.getElementById("open-aftermeet");

function encodePayload(profile) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(profile))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function renderPreview(profile) {
  const lines = [
    profile.fullName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Unknown name",
    [profile.role, profile.company].filter(Boolean).join(" · "),
    profile.email,
    profile.phone,
    profile.linkedinUrl,
  ].filter(Boolean);
  preview.textContent = lines.length ? lines.join("\n") : "No profile details found on this page.";
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(["aftermeetBaseUrl"]);
  baseUrlInput.value = stored.aftermeetBaseUrl || "https://aftermeet-beta.vercel.app";
}

async function saveSettings() {
  await chrome.storage.sync.set({ aftermeetBaseUrl: baseUrlInput.value.trim() || "https://aftermeet-beta.vercel.app" });
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
  const missingContact = !profile.email?.trim() && !profile.phone?.trim();
  if (profile.role?.trim() && profile.company?.trim() && !missingContact) {
    return { profile, message: "Captured profile details from LinkedIn." };
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
    for (const field of ["fullName", "email", "phone", "role", "company", "context"]) {
      const next = payload.profile[field]?.trim?.() ?? "";
      const prev = profile[field]?.trim?.() ?? "";
      if (next) merged[field] = payload.profile[field];
      else if (prev) merged[field] = profile[field];
    }
    if (!merged.fullName && (payload.profile.firstName || payload.profile.lastName)) {
      merged.fullName = [payload.profile.firstName, payload.profile.lastName].filter(Boolean).join(" ");
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

function buildImportUrl(baseUrl, profile) {
  const target = new URL("/app/contacts/linkedin", baseUrl);
  if (profile.linkedinUrl || profile.sourceUrl) {
    target.searchParams.set("url", profile.linkedinUrl || profile.sourceUrl);
  }
  target.searchParams.set("capture", encodePayload(profile));
  target.searchParams.set("source", "extension");
  return target.toString();
}

captureButton.addEventListener("click", async () => {
  openAfterMeetButton.classList.add("hidden");
  status.textContent = "Reading Contact info on this profile…";
  await saveSettings();
  const baseUrl = baseUrlInput.value.trim().replace(/\/+$/, "") || "https://aftermeet-beta.vercel.app";
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
  status.textContent = "Finishing capture…";

  const enriched = await enrichProfile(baseUrl, profile, payload.pageText ?? "");
  renderPreview(enriched.profile);

  const importUrl = buildImportUrl(baseUrl, enriched.profile);
  await chrome.storage.local.set({
    aftermeetLastCapture: {
      importUrl,
      profile: enriched.profile,
      capturedAt: Date.now(),
    },
  });

  openAfterMeetButton.classList.remove("hidden");
  openAfterMeetButton.onclick = () => {
    void chrome.tabs.create({ url: importUrl, active: true });
  };

  const parts = [];
  if (enriched.profile.email) parts.push("email");
  if (enriched.profile.phone) parts.push("phone");
  const contactNote = parts.length
    ? `Captured ${parts.join(" and ")} from LinkedIn.`
    : "No email or phone visible in Contact info for you on LinkedIn.";
  status.textContent = `${contactNote} You stayed on LinkedIn — open AfterMeet only when you're ready.`;
});

baseUrlInput.addEventListener("change", saveSettings);
void loadSettings();
