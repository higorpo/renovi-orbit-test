/** Canonical Minha conta hub (English path segments). */
export const ROUTE_ACCOUNT = "/dashboard/account";

export const ACCOUNT_SECTION = {
  personalInfo: "personal-info",
  addresses: "addresses",
  payments: "payments",
  legalIdentity: "legal-identity",
  professionalProfile: "professional-profile",
  receivables: "receivables",
  earnings: "earnings",
  privacy: "privacy",
  session: "session",
} as const;

export type AccountSectionSlug = (typeof ACCOUNT_SECTION)[keyof typeof ACCOUNT_SECTION];

export function accountSectionPath(section: AccountSectionSlug): string {
  return `${ROUTE_ACCOUNT}/${section}`;
}

export const ROUTE_ACCOUNT_PERSONAL_INFO = accountSectionPath(ACCOUNT_SECTION.personalInfo);
export const ROUTE_ACCOUNT_ADDRESSES = accountSectionPath(ACCOUNT_SECTION.addresses);
export const ROUTE_ACCOUNT_PAYMENTS = accountSectionPath(ACCOUNT_SECTION.payments);
export const ROUTE_ACCOUNT_LEGAL_IDENTITY = accountSectionPath(ACCOUNT_SECTION.legalIdentity);
export const ROUTE_ACCOUNT_PROFESSIONAL_PROFILE = accountSectionPath(
  ACCOUNT_SECTION.professionalProfile,
);
export const ROUTE_ACCOUNT_RECEIVABLES = accountSectionPath(ACCOUNT_SECTION.receivables);
export const ROUTE_ACCOUNT_EARNINGS = accountSectionPath(ACCOUNT_SECTION.earnings);
export const ROUTE_ACCOUNT_PRIVACY = accountSectionPath(ACCOUNT_SECTION.privacy);
export const ROUTE_ACCOUNT_SESSION = accountSectionPath(ACCOUNT_SECTION.session);
