export function normalizeLinkedInUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.split("?")[0]?.replace(/\/+$/, "") ?? trimmed;
  const handle = trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  return handle ? `https://www.linkedin.com/in/${handle}` : "";
}

export function parseLinkedInProfileInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/(?:https?:\/\/)?(?:[a-z]+\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/i);
  const handle = match
    ? decodeURIComponent(match[1]).replace(/\/+$/, "")
    : trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");

  if (!handle || !/^[a-zA-Z0-9\-_%]+$/.test(handle)) return null;

  const url = normalizeLinkedInUrl(trimmed.includes("linkedin.com") ? trimmed : handle);

  return {
    handle,
    url,
    firstName: "",
    lastName: "",
  };
}
