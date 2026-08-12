/** Canonical Configurações hub (English path segments). */
export const ROUTE_SETTINGS = "/dashboard/settings";

export const SETTINGS_SECTION = {
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

export type SettingsSectionSlug = (typeof SETTINGS_SECTION)[keyof typeof SETTINGS_SECTION];

export function settingsSectionPath(section: SettingsSectionSlug): string {
  return `${ROUTE_SETTINGS}/${section}`;
}

export const ROUTE_SETTINGS_PERSONAL_INFO = settingsSectionPath(SETTINGS_SECTION.personalInfo);
export const ROUTE_SETTINGS_ADDRESSES = settingsSectionPath(SETTINGS_SECTION.addresses);
export const ROUTE_SETTINGS_PAYMENTS = settingsSectionPath(SETTINGS_SECTION.payments);
export const ROUTE_SETTINGS_LEGAL_IDENTITY = settingsSectionPath(SETTINGS_SECTION.legalIdentity);
export const ROUTE_SETTINGS_PROFESSIONAL_PROFILE = settingsSectionPath(
  SETTINGS_SECTION.professionalProfile,
);
export const ROUTE_SETTINGS_RECEIVABLES = settingsSectionPath(SETTINGS_SECTION.receivables);
export const ROUTE_SETTINGS_EARNINGS = settingsSectionPath(SETTINGS_SECTION.earnings);
export const ROUTE_SETTINGS_PRIVACY = settingsSectionPath(SETTINGS_SECTION.privacy);
export const ROUTE_SETTINGS_SESSION = settingsSectionPath(SETTINGS_SECTION.session);
