function buildMailtoQuery(input: { subject?: string; body?: string }) {
  const parts: string[] = [];
  if (input.subject?.trim()) {
    parts.push(`subject=${encodeURIComponent(input.subject.trim())}`);
  }
  if (input.body?.trim()) {
    parts.push(`body=${encodeURIComponent(input.body.trim())}`);
  }
  return parts.join("&");
}

export function buildFollowUpEmailBody(personName: string) {
  const greeting = personName.trim()
    ? `Hey ${personName.split(" ")[0]},`
    : "Hey there,";
  return `${greeting}\n\nIt was great meeting you. I'd love to stay in touch.\n\nThanks!`;
}

export function buildFollowUpMailto(email: string, personName: string) {
  const address = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null;

  const query = buildMailtoQuery({
    subject: "Great meeting you",
    body: buildFollowUpEmailBody(personName),
  });
  const encoded = encodeURIComponent(address);
  return query ? `mailto:${encoded}?${query}` : `mailto:${encoded}`;
}
