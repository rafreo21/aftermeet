import {
  countryByIso,
  COUNTRIES_BY_ISO,
  DEFAULT_COUNTRY_ISO,
  detectDefaultCountryIso,
  DIAL_CODE_LOOKUP,
  type Country,
} from "./countries";

export type PhoneParts = {
  countryIso: string;
  nationalNumber: string;
};

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function formatPhoneE164(parts: PhoneParts) {
  const country = countryByIso(parts.countryIso);
  const national = digitsOnly(parts.nationalNumber).replace(/^0+/, "");
  if (!national) return "";
  return `+${country.dialCode}${national}`;
}

export function parseStoredPhone(value: string, defaultIso = detectDefaultCountryIso()): PhoneParts {
  const trimmed = value.trim();
  if (!trimmed) {
    return { countryIso: defaultIso, nationalNumber: "" };
  }

  if (trimmed.startsWith("+")) {
    const digits = digitsOnly(trimmed);
    for (const country of DIAL_CODE_LOOKUP) {
      if (digits.startsWith(country.dialCode)) {
        const nationalNumber = digits.slice(country.dialCode.length);
        if (nationalNumber.length >= 4) {
          return { countryIso: country.iso, nationalNumber };
        }
      }
    }
  }

  const compact = digitsOnly(trimmed);
  const country = countryByIso(defaultIso);
  if (country.dialCode === "44" && compact.startsWith("0")) {
    return { countryIso: country.iso, nationalNumber: compact.slice(1) };
  }
  if (country.dialCode === "1" && compact.length === 10) {
    return { countryIso: country.iso, nationalNumber: compact };
  }

  return { countryIso: defaultIso, nationalNumber: compact };
}

export function formatPhoneDisplay(parts: PhoneParts) {
  return formatPhoneE164(parts);
}

export function isValidPhoneParts(parts: PhoneParts) {
  const e164 = formatPhoneE164(parts);
  const digits = digitsOnly(e164);
  return digits.length >= 8 && digits.length <= 15;
}

export function normalizePhoneInput(value: string, defaultIso = detectDefaultCountryIso()) {
  const parts = parseStoredPhone(value, defaultIso);
  const e164 = formatPhoneE164(parts);
  return isValidPhoneParts(parts) ? e164 : "";
}

export function phonePlaceholder(country: Country) {
  if (country.iso === "US" || country.iso === "CA") return "555 000 0000";
  if (country.iso === "GB") return "7700 900000";
  if (country.iso === "NG") return "801 234 5678";
  return "Phone number";
}

export function defaultPhoneParts() {
  return {
    countryIso: detectDefaultCountryIso() || DEFAULT_COUNTRY_ISO,
    nationalNumber: "",
  } satisfies PhoneParts;
}

export function countryFromPhoneValue(value: string, fallbackIso = detectDefaultCountryIso()) {
  return countryByIso(parseStoredPhone(value, fallbackIso).countryIso);
}

export { detectDefaultCountryIso, countryByIso, COUNTRIES_BY_ISO };
