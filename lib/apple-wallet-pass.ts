const MIN_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export function walletIconBuffers() {
  return {
    "icon.png": MIN_PNG,
    "icon@2x.png": MIN_PNG,
    "logo.png": MIN_PNG,
    "logo@2x.png": MIN_PNG,
  };
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "rgb(22, 51, 0)";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

export function buildApplePassJson(card: {
  slug: string;
  fullName: string;
  role: string;
  company: string;
  bio: string;
  themeColor: string;
  cardUrl: string;
  companyLogoUrl?: string;
  showCompany?: boolean;
}, certs: { passTypeId: string; teamId: string }) {
  const companyVisible = card.showCompany !== false && card.company.trim();
  return {
    formatVersion: 1,
    passTypeIdentifier: certs.passTypeId,
    teamIdentifier: certs.teamId,
    organizationName: "AfterMeet",
    description: `${card.fullName} · AfterMeet card`,
    serialNumber: `${card.slug}-${Date.now()}`,
    logoText: companyVisible ? card.company : "AfterMeet",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: hexToRgb(card.themeColor || "#9fe870"),
    labelColor: "rgb(22, 51, 0)",
    generic: {
      headerFields: [
        {
          key: "card_type",
          label: "CARD",
          value: "AfterMeet",
        },
      ],
      primaryFields: [{ key: "name", label: "NAME", value: card.fullName }],
      secondaryFields: card.role
        ? [{ key: "role", label: "JOB TITLE", value: card.role }]
        : [],
      auxiliaryFields: companyVisible
        ? [{ key: "company", label: "COMPANY", value: card.company }]
        : [],
      backFields: [
        { key: "bio", label: "About", value: card.bio || "Scan the QR code to open my AfterMeet card." },
        { key: "link", label: "Card link", value: card.cardUrl },
      ],
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: card.cardUrl,
        messageEncoding: "iso-8859-1",
        altText: "Scan to connect",
      },
    ],
  };
}
