import { NextResponse } from "next/server";

import { normalizeLinkedInUrl, parseLinkedInProfileInput } from "../../../../lib/linkedin-profile";
import { parseLinkedInProfileHtml } from "../../../../lib/linkedin-enrichment";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("url")?.trim() ?? "";
  const parsed = parseLinkedInProfileInput(raw);
  if (!parsed) {
    return NextResponse.json({ error: "Paste a valid LinkedIn profile URL." }, { status: 400 });
  }

  const profileUrl = normalizeLinkedInUrl(parsed.url);
  try {
    const response = await fetch(profileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json({
        profile: {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          role: "",
          company: "",
          linkedinUrl: profileUrl,
          handle: parsed.handle,
        },
        source: "url_only",
        message: "LinkedIn blocked automated lookup. Add name, role, and company from your conversation.",
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const html = await response.text();
    const enriched = parseLinkedInProfileHtml(html, parsed.handle);
    return NextResponse.json({
      profile: {
        firstName: enriched?.firstName || "",
        lastName: enriched?.lastName || "",
        role: enriched?.role || "",
        company: enriched?.company || "",
        linkedinUrl: profileUrl,
        handle: parsed.handle,
      },
      source: enriched ? "opengraph" : "url_only",
      message: enriched
        ? "Loaded public profile details from LinkedIn."
        : "LinkedIn did not expose verified profile details. Add name, role, and company from your conversation.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({
      profile: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        role: "",
        company: "",
        linkedinUrl: profileUrl,
        handle: parsed.handle,
      },
      source: "url_only",
      message: "Could not reach LinkedIn. Check the fields below before saving.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
