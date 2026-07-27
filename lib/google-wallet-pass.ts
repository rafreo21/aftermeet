import { createSign } from "node:crypto";

import type { GoogleWalletConfig, WalletCardPayload } from "./wallet-config";

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signJwt(payload: Record<string, unknown>, config: GoogleWalletConfig) {
  const header = { alg: "RS256", typ: "JWT" };
  const encoded = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(encoded);
  signer.end();
  return `${encoded}.${signer.sign(config.privateKey, "base64url")}`;
}

export function buildGoogleWalletSaveUrl(card: WalletCardPayload, config: GoogleWalletConfig) {
  const classId = `${config.issuerId}.${config.classSuffix}`;
  const objectId = `${config.issuerId}.${card.slug}`;
  const companyVisible = card.showCompany !== false && card.company.trim();
  const companyLabel = companyVisible || " ";
  const genericObject: Record<string, unknown> = {
    id: objectId,
    classId,
    state: "ACTIVE",
    hexBackgroundColor: card.themeColor.startsWith("#") ? card.themeColor : `#${card.themeColor}`,
    cardTitle: {
      defaultValue: { language: "en-US", value: card.fullName },
    },
    header: {
      defaultValue: { language: "en-US", value: "AfterMeet Card" },
    },
    subheader: {
      defaultValue: { language: "en-US", value: card.role || companyLabel.trim() || "Digital card" },
    },
    barcode: {
      type: "QR_CODE",
      value: card.cardUrl,
      alternateText: "Scan to connect",
    },
    textModulesData: [
      { id: "name", header: "NAME", body: card.fullName },
      { id: "role", header: "JOB TITLE", body: card.role || " " },
      { id: "company", header: "COMPANY", body: companyLabel },
      { id: "bio", header: "About", body: card.bio || "Tap to open my AfterMeet card." },
    ],
    linksModuleData: {
      uris: [
        {
          uri: card.cardUrl,
          description: "Open AfterMeet card",
          id: "card_link",
        },
      ],
    },
  };

  if (card.profileImageUrl?.trim()) {
    genericObject.heroImage = {
      sourceUri: { uri: card.profileImageUrl.trim() },
    };
  }

  const payload = {
    iss: config.serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [new URL(card.cardUrl).origin],
    payload: {
      genericClasses: [
        {
          id: classId,
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [
                {
                  twoItems: {
                    startItem: {
                      firstValue: {
                        fields: [{ fieldPath: "object.textModulesData['role']" }],
                      },
                    },
                    endItem: {
                      firstValue: {
                        fields: [{ fieldPath: "object.textModulesData['company']" }],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      ],
      genericObjects: [genericObject],
    },
  };

  const token = signJwt(payload, config);
  return `https://pay.google.com/gp/v/save/${token}`;
}
