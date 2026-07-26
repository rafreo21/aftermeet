export function parseScopes(scope?: string) {
  return scope?.split(/\s+/).filter(Boolean) ?? [];
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function buildPlainEmailRaw(to: string, subject: string, body: string) {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    body,
  ];
  return encodeBase64Url(headers.join("\r\n"));
}
