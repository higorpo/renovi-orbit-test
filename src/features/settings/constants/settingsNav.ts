import {
  Banknote,
  Briefcase,
  CreditCard,
  IdCard,
  Lock,
  LogOut,
  MapPin,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProfileRole } from "@/features/auth";
import {
  SETTINGS_SECTION,
  settingsSectionPath,
  type SettingsSectionSlug,
} from "./routes";

export interface SettingsNavItem {
  slug: SettingsSectionSlug;
  path: string;
  label: string;
  icon: LucideIcon;
  /** Shown below the divider (session / danger). */
  footer?: boolean;
}

const SHARED_FOOTER: SettingsNavItem[] = [
  {
    slug: SETTINGS_SECTION.privacy,
    path: settingsSectionPath(SETTINGS_SECTION.privacy),
    label: "Privacidade",
    icon: Shield,
  },
  {
    slug: SETTINGS_SECTION.session,
    path: settingsSectionPath(SETTINGS_SECTION.session),
    label: "Conta",
    icon: LogOut,
    footer: true,
  },
];

const CLIENT_ITEMS: SettingsNavItem[] = [
  {
    slug: SETTINGS_SECTION.personalInfo,
    path: settingsSectionPath(SETTINGS_SECTION.personalInfo),
    label: "Informações pessoais",
    icon: User,
  },
  {
    slug: SETTINGS_SECTION.addresses,
    path: settingsSectionPath(SETTINGS_SECTION.addresses),
    label: "Endereços",
    icon: MapPin,
  },
  {
    slug: SETTINGS_SECTION.payments,
    path: settingsSectionPath(SETTINGS_SECTION.payments),
    label: "Pagamentos",
    icon: CreditCard,
  },
  ...SHARED_FOOTER,
];

const PROVIDER_ITEMS: SettingsNavItem[] = [
  {
    slug: SETTINGS_SECTION.personalInfo,
    path: settingsSectionPath(SETTINGS_SECTION.personalInfo),
    label: "Informações pessoais",
    icon: User,
  },
  {
    slug: SETTINGS_SECTION.legalIdentity,
    path: settingsSectionPath(SETTINGS_SECTION.legalIdentity),
    label: "Identidade legal",
    icon: IdCard,
  },
  {
    slug: SETTINGS_SECTION.professionalProfile,
    path: settingsSectionPath(SETTINGS_SECTION.professionalProfile),
    label: "Perfil profissional",
    icon: Briefcase,
  },
  {
    slug: SETTINGS_SECTION.receivables,
    path: settingsSectionPath(SETTINGS_SECTION.receivables),
    label: "Recebimentos",
    icon: Banknote,
  },
  {
    slug: SETTINGS_SECTION.earnings,
    path: settingsSectionPath(SETTINGS_SECTION.earnings),
    label: "Ganhos",
    icon: Wallet,
  },
  ...SHARED_FOOTER,
];

export function getSettingsNavItems(role: ProfileRole): SettingsNavItem[] {
  return role === "provider" ? PROVIDER_ITEMS : CLIENT_ITEMS;
}

/** Labels for mobile stack chrome. */
export const SETTINGS_SECTION_STACK_TITLE: Record<SettingsSectionSlug, string> = {
  "personal-info": "Informações pessoais",
  addresses: "Endereços",
  payments: "Pagamentos",
  "legal-identity": "Identidade legal",
  "professional-profile": "Perfil profissional",
  receivables: "Recebimentos",
  earnings: "Ganhos",
  privacy: "Privacidade",
  session: "Conta",
};

export const CLIENT_ONLY_SETTINGS_SECTIONS: SettingsSectionSlug[] = [
  SETTINGS_SECTION.addresses,
  SETTINGS_SECTION.payments,
];

export const PROVIDER_ONLY_SETTINGS_SECTIONS: SettingsSectionSlug[] = [
  SETTINGS_SECTION.legalIdentity,
  SETTINGS_SECTION.professionalProfile,
  SETTINGS_SECTION.receivables,
  SETTINGS_SECTION.earnings,
];
