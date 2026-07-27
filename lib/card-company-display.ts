export const COMPANY_METHOD_TYPES = new Set(["website"]);

type CompanyVisibilityLike = {
  showCompanyDetails?: boolean;
  showCompanyLogo?: boolean;
};

export function showsCompanyDetails(card: CompanyVisibilityLike) {
  return card.showCompanyDetails ?? card.showCompanyLogo ?? true;
}

export function filterMethodsForCompanyVisibility<
  T extends { type?: string; method_type?: string },
>(methods: T[], showCompany: boolean) {
  if (showCompany) return methods;
  return methods.filter((method) => !COMPANY_METHOD_TYPES.has(method.type ?? method.method_type ?? ""));
}

export function publicCompanyField(company: string | null | undefined, showCompany: boolean) {
  if (!showCompany) return null;
  const trimmed = company?.trim();
  return trimmed || null;
}

export function publicCompanyLogoUrl(logoUrl: string | null | undefined, showCompany: boolean) {
  if (!showCompany) return null;
  const trimmed = logoUrl?.trim();
  return trimmed || null;
}
