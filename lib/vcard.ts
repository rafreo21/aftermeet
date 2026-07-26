import type { Contact } from "./contacts";
import { splitFullName } from "./contacts";

export function parseVcard(text: string): Contact[] {
  return text.split(/END:VCARD/i).map((card, index) => {
    const field = (name: string) => card.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "im"))?.[1]?.trim() || "";
    const [lastName = "", firstName = ""] = field("N").split(";");
    const fullName = field("FN");
    const parsedName = fullName ? splitFullName(fullName) : { firstName, lastName };
    return {
      id: `vcard-${Date.now()}-${index}`,
      firstName: parsedName.firstName || firstName || fullName.split(" ")[0] || "",
      lastName: parsedName.lastName || lastName || fullName.split(" ").slice(1).join(" "),
      email: field("EMAIL"),
      phone: field("TEL"),
      company: field("ORG").replace(/;/g, " "),
      role: field("TITLE"),
      context: "",
      source: "vcard" as const,
    };
  }).filter((contact) => contact.firstName || contact.lastName || contact.email);
}

export function parseVcardSingle(text: string) {
  return parseVcard(text)[0] ?? null;
}
