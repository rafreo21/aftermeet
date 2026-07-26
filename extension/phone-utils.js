(function initAfterMeetPhoneUtils() {
  const COUNTRY_DIAL_CODES = [
    [/\bunited states\b|\b(u\.?s\.?a?\.?)\b|\bamerica\b/i, "1"],
    [/\bunited kingdom\b|\b(u\.?k\.?)\b|\bengland\b|\bscotland\b|\bwales\b/i, "44"],
    [/\bnigeria\b|\blagos\b|\babuja\b/i, "234"],
    [/\bkenya\b|\bnairobi\b/i, "254"],
    [/\bghana\b|\baccr[a]?a\b/i, "233"],
    [/\bsouth africa\b|\bjohannesburg\b|\bcape town\b/i, "27"],
    [/\bcanada\b|\btoronto\b|\bvancouver\b/i, "1"],
    [/\bindia\b|\bbengaluru\b|\bbangalore\b|\bmumbai\b|\bdelhi\b/i, "91"],
    [/\bgermany\b|\bberlin\b|\bmunich\b/i, "49"],
    [/\bfrance\b|\bparis\b/i, "33"],
    [/\baustralia\b|\bsydney\b|\bmelbourne\b/i, "61"],
    [/\buae\b|\bdubai\b|\bunited arab emirates\b/i, "971"],
    [/\bsingapore\b/i, "65"],
    [/\bireland\b|\bdublin\b/i, "353"],
  ];

  function clean(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function isLikelyNonPhoneText(value) {
    const cleaned = clean(value);
    if (!cleaned) return true;
    if (/^\d{4}\s*[–-]\s*(present|\d{4})/i.test(cleaned)) return true;
    if (/^(19|20)\d{2}$/.test(cleaned)) return true;
    if (/^(present|full-time|part-time)$/i.test(cleaned)) return true;
    return false;
  }

  function inferDialCodeFromLocation(location) {
    const normalized = clean(location);
    if (!normalized) return "";
    for (const [pattern, code] of COUNTRY_DIAL_CODES) {
      if (pattern.test(normalized)) return code;
    }
    return "";
  }

  function applyCountryCodeIfNeeded(phone, dialCode) {
    if (!phone || phone.startsWith("+") || !dialCode) return phone;
    const digits = phone.replace(/\D/g, "");
    if (!digits || digits.length < 7) return phone;
    if (dialCode === "44" && digits.startsWith("0")) return `+44${digits.slice(1)}`;
    if (dialCode === "1" && digits.length === 10) return `+1${digits}`;
    const trimmed = digits.replace(/^0+/, "");
    if (trimmed.length >= 7 && trimmed.length <= 12) return `+${dialCode}${trimmed}`;
    return phone;
  }

  function normalizePhoneNumber(value) {
    if (isLikelyNonPhoneText(value)) return "";
    const cleaned = clean(value);
    const intlMatch = cleaned.match(/(\+\d[\d\s().-]{5,})/);
    if (intlMatch) {
      const body = intlMatch[1].replace(/[^\d+]/g, "").replace(/^\+/, "");
      if (body.length >= 7 && body.length <= 15) return `+${body}`;
    }
    const compact = cleaned.replace(/\s/g, "");
    if (compact.startsWith("00")) {
      const body = compact.replace(/[^\d]/g, "").replace(/^00/, "");
      if (body.length >= 7 && body.length <= 15) return `+${body}`;
    }
    const digits = cleaned.replace(/[^\d]/g, "");
    if (digits.length >= 7 && digits.length <= 15 && !/^(19|20)\d{2}$/.test(digits)) {
      return digits;
    }
    return "";
  }

  function isValidPhoneNumber(value) {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) return false;
    const digits = normalized.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return false;
    if (/^(19|20)\d{2}$/.test(digits)) return false;
    return true;
  }

  function sanitizePhoneNumber(value, locationHint = "") {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) return "";
    const dialCode = inferDialCodeFromLocation(locationHint);
    const withCountry = applyCountryCodeIfNeeded(normalized, dialCode);
    return isValidPhoneNumber(withCountry) ? withCountry : "";
  }

  function readLinkedInProfileLocation() {
    const selectors = [
      ".pv-text-details__left-panel .text-body-small",
      ".text-body-small.inline.t-black--light.break-words",
      "span.text-body-small.inline",
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = clean(node?.textContent);
      if (text && text.length <= 80 && !/@/.test(text)) return text;
    }
    return "";
  }

  window.aftermeetSanitizePhoneNumber = sanitizePhoneNumber;
  window.aftermeetReadLinkedInProfileLocation = readLinkedInProfileLocation;
})();
