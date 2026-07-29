import type { CardVcardInput } from "./vcard-export.ts";
import { buildCardVcard } from "./vcard-export.ts";
import type { ShareAssetProfile } from "./share-assets.ts";

/** QR payload that saves contact details offline; includes the card URL when online. */
export function buildContactQrPayload(input: CardVcardInput): string {
  return buildCardVcard(input).body.trim();
}

export function shareAssetProfileToVcardInput(profile: ShareAssetProfile): CardVcardInput {
  return {
    fullName: profile.name,
    jobTitle: profile.role,
    company: profile.company,
    bio: "",
    cardUrl: profile.cardUrl,
    showCompanyDetails: profile.showCompany,
    methods: (profile.methods ?? []).map((method) => ({
      method_type: method.method_type,
      value: method.value,
      label: method.label ?? null,
    })),
  };
}

export function buildContactQrPayloadFromShareProfile(profile: ShareAssetProfile): string {
  return buildContactQrPayload(shareAssetProfileToVcardInput(profile));
}
