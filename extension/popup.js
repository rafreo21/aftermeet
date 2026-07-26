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
    profile.personalWebsite,
    profile.companyWebsite,
    profile.linkedinUrl,
  ].filter(Boolean);
  preview.textContent = lines.join("\n");
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(["aftermeetBaseUrl"]);
  baseUrlInput.value = stored.aftermeetBaseUrl || "http://localhost:3000";
}

async function saveSettings() {
  await chrome.storage.sync.set({ aftermeetBaseUrl: baseUrlInput.value.trim() || "http://localhost:3000" });
}

captureButton.addEventListener("click", async () => {
  status.textContent = "Capturing visible page details…";
  await saveSettings();
  const baseUrl = baseUrlInput.value.trim().replace(/\/+$/, "") || "http://localhost:3000";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    status.textContent = "No active tab found.";
    return;
  }

  let payload;
  try {
    payload = await chrome.tabs.sendMessage(tab.id, { type: "aftermeet-capture" });
  } catch {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const clean = (value) => (value ?? "").replace(/\s+/g, " ").trim();
        const splitName = (fullName) => {
          const parts = clean(fullName).split(/\s+/).filter(Boolean);
          return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
        };
        const normalizeUrl = (value) => {
          const trimmed = clean(value);
          if (!trimmed) return "";
          if (/^https?:\/\//i.test(trimmed)) return trimmed.split("?")[0].replace(/\/+$/, "");
          return `https://${trimmed.replace(/^\/\//, "")}`;
        };
        const sourceUrl = normalizeUrl(window.location.href.split("?")[0]);
        const title = clean(document.title);
        const h1 = clean(document.querySelector("h1")?.textContent);
        const { firstName, lastName } = splitName(h1 || title.split("|")[0] || title);
        return {
          profile: {
            firstName,
            lastName,
            email: "",
            phone: "",
            company: "",
            role: "",
            companyWebsite: /linkedin\.com/i.test(sourceUrl) ? "" : sourceUrl,
            personalWebsite: "",
            linkedinUrl: /linkedin\.com\/in\//i.test(sourceUrl) ? sourceUrl : "",
            sourceUrl,
            source: "extension",
          },
          pageText: document.body?.innerText?.slice(0, 6000) ?? "",
        };
      },
    });
    payload = result;
  }

  const profile = payload?.profile;
  if (!profile) {
    status.textContent = "Could not read this page.";
    return;
  }

  renderPreview(profile);

  try {
    await fetch(`${baseUrl}/api/contacts/capture`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, pageText: payload.pageText ?? "" }),
    });
  } catch {
    // Opening AfterMeet still works without AI cleanup.
  }

  const target = new URL("/app/contacts/linkedin", baseUrl);
  if (profile.linkedinUrl || profile.sourceUrl) target.searchParams.set("url", profile.linkedinUrl || profile.sourceUrl);
  target.searchParams.set("capture", encodePayload(profile));
  target.searchParams.set("source", "extension");
  chrome.tabs.create({ url: target.toString() });
  status.textContent = "Opened AfterMeet for review.";
});

baseUrlInput.addEventListener("change", saveSettings);
void loadSettings();
