import "server-only";

import { buildPlainEmailRaw } from "./email";

export async function sendGoogleEmail(accessToken: string, input: { to: string; subject: string; body: string }) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: buildPlainEmailRaw(input.to, input.subject, input.body) }),
  });
  if (!response.ok) throw new Error("Gmail rejected this message.");
  return response.json();
}

export async function sendMicrosoftEmail(accessToken: string, input: { to: string; subject: string; body: string }) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "Text", content: input.body },
        toRecipients: [{ emailAddress: { address: input.to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!response.ok) throw new Error("Outlook rejected this message.");
}

function defaultMeetingWindow(dueAt: string) {
  const start = dueAt ? new Date(`${dueAt}T10:00:00`) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start, end };
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  input: { title: string; details: string; dueAt: string; attendeeEmail?: string },
) {
  const { start, end } = defaultMeetingWindow(input.dueAt);
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.title,
      description: input.details,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      ...(input.attendeeEmail ? { attendees: [{ email: input.attendeeEmail }] } : {}),
    }),
  });
  if (!response.ok) throw new Error("Google Calendar rejected this event.");
  return response.json();
}

export async function createMicrosoftCalendarEvent(
  accessToken: string,
  input: { title: string; details: string; dueAt: string; attendeeEmail?: string },
) {
  const { start, end } = defaultMeetingWindow(input.dueAt);
  const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: input.title,
      body: { contentType: "Text", content: input.details },
      start: { dateTime: start.toISOString(), timeZone: "UTC" },
      end: { dateTime: end.toISOString(), timeZone: "UTC" },
      ...(input.attendeeEmail
        ? { attendees: [{ emailAddress: { address: input.attendeeEmail }, type: "required" }] }
        : {}),
    }),
  });
  if (!response.ok) throw new Error("Outlook Calendar rejected this event.");
  return response.json();
}
