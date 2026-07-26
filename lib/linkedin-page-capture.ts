import {
  captureExperienceFromSection,
  parseExperienceSectionText,
  sanitizeExperienceRoleCompany,
} from "./linkedin-experience-capture.ts";

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function parseHeadline(headline: string) {
  const cleaned = clean(headline);
  if (!cleaned) return { role: "", company: "" };

  const atMatch = cleaned.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return { role: clean(atMatch[1]), company: clean(atMatch[2]) };
  }

  const dotParts = cleaned.split(/\s*[·|@]\s*/).map(clean).filter(Boolean);
  if (dotParts.length >= 2) {
    return { role: dotParts[0], company: dotParts.slice(1).join(" · ") };
  }

  return { role: cleaned, company: "" };
}

function stripEmploymentSuffix(value: string) {
  return clean(value.split(" · ")[0]?.split(" | ")[0]);
}

function isJunkProfileLine(line: string) {
  const value = clean(line);
  if (!value) return true;
  if (value.length > 120) return true;
  if (/^\d+\+?\s*connections?$/i.test(value)) return true;
  if (/^(message|connect|follow|more|contact info|about|activity|posts|comments|videos|images|documents)$/i.test(value)) return true;
  if (/^(open to work|hiring|verified|premium|top voice|uk global talent)$/i.test(value)) return true;
  if (/^[A-Z][a-z]+(?:,\s*[A-Z][a-z]+){0,3},\s*[A-Z][a-z]+(?: Area)?(?:,\s*[A-Z][a-z]+)?$/.test(value)) return true;
  if (/^•/.test(value)) return true;
  if (/^(full-time|part-time|contract|self-employed|internship|freelance)$/i.test(value)) return true;
  if (/^\d{4}\s*[–-]\s*(present|\d{4})/i.test(value)) return true;
  return false;
}

export function parseExperienceFromText(pageText: string) {
  return parseExperienceSectionText(pageText);
}

export function parseContactInfoFromText(pageText: string) {
  const lines = pageText.split("\n").map(clean).filter(Boolean);
  let email = "";
  let phone = "";

  for (const line of lines) {
    if (!email) {
      const match = line.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
      if (match) email = match[0].toLowerCase();
    }
  }

  const emailIndex = lines.findIndex((line) => /^email$/i.test(line));
  if (emailIndex >= 0 && !email) {
    for (const line of lines.slice(emailIndex + 1, emailIndex + 4)) {
      const match = line.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
      if (match) {
        email = match[0].toLowerCase();
        break;
      }
    }
  }

  const phoneIndex = lines.findIndex((line) => /^phone$/i.test(line));
  if (phoneIndex >= 0) {
    for (const line of lines.slice(phoneIndex + 1, phoneIndex + 4)) {
      const match = line.match(/(\+\d[\d\s().-]{7,}\d)/);
      if (match) {
        phone = match[1].replace(/[^\d+]/g, "").replace(/^\+/, "+");
        break;
      }
    }
  }

  if (!phone) {
    const match = pageText.match(/(\+\d[\d\s().-]{7,}\d)/);
    if (match) phone = match[1].replace(/[^\d+]/g, "").replace(/^\+/, "+");
  }

  return { email, phone };
}

export function headlineFromPageText(pageText: string, fullName: string) {
  const lines = pageText.split("\n").map(clean).filter(Boolean);
  const nameIndex = lines.findIndex((line) => line === fullName || line.startsWith(fullName));
  if (nameIndex < 0) return "";
  for (let index = nameIndex + 1; index < Math.min(nameIndex + 6, lines.length); index += 1) {
    const candidate = lines[index];
    if (isJunkProfileLine(candidate)) continue;
    if (/ at | · /.test(candidate)) return candidate;
  }
  return "";
}

export function buildLinkedInCaptureContext(profile: {
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}) {
  const parts: string[] = [];
  if (profile.role && profile.company) {
    parts.push(`Current role: ${profile.role} at ${profile.company}.`);
  } else if (profile.role) {
    parts.push(`Current role: ${profile.role}.`);
  }
  if (profile.email) parts.push(`Email visible on LinkedIn: ${profile.email}.`);
  if (profile.phone) parts.push(`Phone visible on LinkedIn: ${profile.phone}.`);
  if (profile.linkedinUrl) parts.push(`Profile: ${profile.linkedinUrl}.`);
  return parts.join(" ");
}

export function mergeLinkedInRoleCompany(experience: { role: string; company: string }) {
  return sanitizeExperienceRoleCompany(experience);
}

export const LINKEDIN_PROFILE_FIXTURE = `
Raphael Okojie
Product Designer at Nexleaf
London, England, United Kingdom
500+ connections
UK Global Talent
Experience
Product Designer
Nexleaf Analytics · Full-time
Jan 2025 – Present · 1 yr 7 mos
London Area, United Kingdom · Remote
Contact info
Your Profile
linkedin.com/in/rafreo
Phone
+447473177720 (Mobile)
Email
rafreo21@gmail.com
`.trim();
