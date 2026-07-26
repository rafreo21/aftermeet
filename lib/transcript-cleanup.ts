export function cleanLiveTranscript(raw: string) {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "";

  text = text.replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");
  text = text.replace(/\b(\w+\s+\w+)(?:\s+\1\b)+/gi, "$1");

  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
  const seen = new Set<string>();
  const unique = sentences.filter((sentence) => {
    const key = sentence.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.join(" ").trim();
}

export function normalizeTranscriptForExtraction(raw: string) {
  return cleanLiveTranscript(raw);
}
