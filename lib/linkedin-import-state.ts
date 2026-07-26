import type { Contact } from "./contacts.ts";
import type { CapturedProfile } from "./page-profile-capture.ts";

export type LinkedInImportInitialState = {
  input: string;
  importSource: Contact["source"];
  form: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    company: string;
    context: string;
  };
  lookupStatus: "idle" | "loading" | "ready" | "partial";
  lookupMessage: string;
  isExtensionImport: boolean;
};

const emptyProfileFields = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "",
  company: "",
};

export function decodeCaptureParam(raw: string): Partial<CapturedProfile> | null {
  try {
    const json = decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))));
    return JSON.parse(json) as Partial<CapturedProfile>;
  } catch {
    return null;
  }
}

export function buildLinkedInImportInitialState(input: {
  url?: string;
  capture?: string;
  source?: string;
}): LinkedInImportInitialState {
  const initialUrl = input.url?.trim() ?? "";
  const capture = input.capture?.trim() ?? "";
  const source = input.source?.trim() ?? "";
  const profile = capture ? decodeCaptureParam(capture) : null;

  if (profile) {
    const isExtensionImport = source === "extension";
    return {
      input: profile.linkedinUrl?.trim() || profile.sourceUrl?.trim() || initialUrl,
      importSource: isExtensionImport ? "extension" : "linkedin",
      form: {
        firstName: profile.firstName?.trim() || "",
        lastName: profile.lastName?.trim() || "",
        email: profile.email?.trim() || "",
        phone: profile.phone?.trim() || "",
        role: profile.role?.trim() || "",
        company: profile.company?.trim() || "",
        context: profile.context?.trim()
          || (isExtensionImport ? "Captured from browser extension." : "Added from LinkedIn."),
      },
      lookupStatus: "ready",
      lookupMessage: "Imported visible page details from your browser. Checking LinkedIn for anything else we can verify…",
      isExtensionImport,
    };
  }

  return {
    input: initialUrl,
    importSource: "linkedin",
    form: {
      ...emptyProfileFields,
      context: "Added from LinkedIn.",
    },
    lookupStatus: "idle",
    lookupMessage: "",
    isExtensionImport: false,
  };
}
