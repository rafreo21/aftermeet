import type { Encounter, EncounterAction } from "./encounters";

export type ActionLinkContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
};

export type ActionLinkContext = {
  personName: string;
  personEmail: string;
  phone?: string;
  linkedinUrl?: string;
  encounterTitle?: string;
};

export type ActionLink = {
  href: string;
  label: string;
  external: boolean;
  unavailableReason?: string;
};

export function channelLabel(channel: EncounterAction["channel"]) {
  switch (channel) {
    case "call": return "Call";
    case "linkedin": return "LinkedIn";
    case "email": return "Email";
    case "meeting": return "Meeting";
    case "send": return "Send file";
    default: return "Follow-up";
  }
}

export function buildActionLinkContext(
  encounter: Pick<Encounter, "personName" | "personEmail" | "title">,
  contact?: ActionLinkContact | null,
): ActionLinkContext {
  return {
    personName: encounter.personName || (contact ? `${contact.firstName} ${contact.lastName}`.trim() : ""),
    personEmail: contact?.email || encounter.personEmail || "",
    phone: contact?.phone,
    linkedinUrl: contact?.linkedinUrl,
    encounterTitle: encounter.title,
  };
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

function normalizeLinkedInUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\//, "")}`;
}

function linkedInSearchUrl(personName: string) {
  const query = personName.trim() || "contact";
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}`;
}

function mailtoLink(to: string, subject: string, body: string) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();
  if (to) return `mailto:${to}${query ? `?${query}` : ""}`;
  return `mailto:${query ? `?${query}` : ""}`;
}

function gmailComposeLink(to: string, subject: string, body: string) {
  const params = new URLSearchParams({ view: "cm", fs: "1" });
  if (to) params.set("to", to);
  if (subject) params.set("su", subject);
  if (body) params.set("body", body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function outlookComposeLink(to: string, subject: string, body: string) {
  const params = new URLSearchParams();
  if (to) params.set("to", to);
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

function googleCalendarLink(title: string, details: string, dueAt: string) {
  const start = dueAt ? new Date(`${dueAt}T10:00:00`) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details,
    dates: `${format(start)}/${format(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function outlookCalendarLink(title: string, details: string, dueAt: string) {
  const start = dueAt ? new Date(`${dueAt}T10:00:00`) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const params = new URLSearchParams({
    subject: title,
    body: details,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    path: "/calendar/action/compose",
    rru: "addevent",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function googleDriveLink() {
  return "https://drive.google.com/drive/my-drive";
}

export function resolveActionLink(
  action: Pick<EncounterAction, "channel" | "title" | "dueAt">,
  context: ActionLinkContext,
): ActionLink {
  const subject = context.encounterTitle || "Follow-up from AfterMeet";
  const body = action.title.trim();

  switch (action.channel) {
    case "call": {
      const phone = normalizePhone(context.phone ?? "");
      if (!phone) {
        return {
          href: "",
          label: "Call",
          external: false,
          unavailableReason: "Add their phone number on the People record to call.",
        };
      }
      return { href: `tel:${phone}`, label: "Call", external: false };
    }
    case "linkedin": {
      const href = context.linkedinUrl
        ? normalizeLinkedInUrl(context.linkedinUrl)
        : linkedInSearchUrl(context.personName);
      return { href, label: "Open LinkedIn", external: true };
    }
    case "meeting": {
      const title = body || `Meeting with ${context.personName || "contact"}`;
      const details = `Scheduled from AfterMeet${context.encounterTitle ? `: ${context.encounterTitle}` : ""}.`;
      return {
        href: googleCalendarLink(title, details, action.dueAt),
        label: "Schedule in Google Calendar",
        external: true,
      };
    }
    case "send": {
      const sendBody = `${body}\n\nAttach your file in Gmail, or open Google Drive to share it.`;
      if (context.personEmail) {
        return {
          href: gmailComposeLink(context.personEmail, subject, sendBody),
          label: "Send in Gmail",
          external: true,
        };
      }
      return {
        href: googleDriveLink(),
        label: "Open Google Drive",
        external: true,
      };
    }
    case "email":
    case "other":
    default: {
      if (context.personEmail) {
        return {
          href: gmailComposeLink(context.personEmail, subject, body),
          label: "Send in Gmail",
          external: true,
        };
      }
      return {
        href: mailtoLink("", subject, body),
        label: "Send email",
        external: false,
      };
    }
  }
}

export function resolveSecondaryActionLinks(
  action: Pick<EncounterAction, "channel" | "title" | "dueAt">,
  context: ActionLinkContext,
): ActionLink[] {
  const subject = context.encounterTitle || "Follow-up from AfterMeet";
  const body = action.title.trim();
  const links: ActionLink[] = [];

  if (action.channel === "email" || action.channel === "send" || action.channel === "other") {
    if (context.personEmail) {
      links.push({
        href: outlookComposeLink(context.personEmail, subject, body),
        label: "Outlook",
        external: true,
      });
      links.push({
        href: mailtoLink(context.personEmail, subject, body),
        label: "Mail app",
        external: false,
      });
    }
    if (action.channel === "send") {
      links.push({ href: googleDriveLink(), label: "Drive", external: true });
    }
  }

  if (action.channel === "meeting") {
    const title = body || `Meeting with ${context.personName || "contact"}`;
    const details = `Scheduled from AfterMeet${context.encounterTitle ? `: ${context.encounterTitle}` : ""}.`;
    links.push({
      href: outlookCalendarLink(title, details, action.dueAt),
      label: "Outlook Calendar",
      external: true,
    });
  }

  return links;
}
