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
  ACCOUNT_SECTION,
  accountSectionPath,
  type AccountSectionSlug,
} from "./routes";

export interface AccountNavItem {
  slug: AccountSectionSlug;
  path: string;
  label: string;
  icon: LucideIcon;
  /** Shown below the divider (session / danger). */
  footer?: boolean;
}

const SHARED_FOOTER: AccountNavItem[] = [
  {
    slug: ACCOUNT_SECTION.privacy,
    path: accountSectionPath(ACCOUNT_SECTION.privacy),
    label: "Privacidade",
    icon: Shield,
  },
  {
    slug: ACCOUNT_SECTION.session,
    path: accountSectionPath(ACCOUNT_SECTION.session),
    label: "Conta",
    icon: LogOut,
    footer: true,
  },
];

const CLIENT_ITEMS: AccountNavItem[] = [
  {
    slug: ACCOUNT_SECTION.personalInfo,
    path: accountSectionPath(ACCOUNT_SECTION.personalInfo),
    label: "Informações pessoais",
    icon: User,
  },
  {
    slug: ACCOUNT_SECTION.addresses,
    path: accountSectionPath(ACCOUNT_SECTION.addresses),
    label: "Endereços",
    icon: MapPin,
  },
  {
    slug: ACCOUNT_SECTION.payments,
    path: accountSectionPath(ACCOUNT_SECTION.payments),
    label: "Pagamentos",
    icon: CreditCard,
  },
  ...SHARED_FOOTER,
];

const PROVIDER_ITEMS: AccountNavItem[] = [
  {
    slug: ACCOUNT_SECTION.personalInfo,
    path: accountSectionPath(ACCOUNT_SECTION.personalInfo),
    label: "Informações pessoais",
    icon: User,
  },
  {
    slug: ACCOUNT_SECTION.legalIdentity,
    path: accountSectionPath(ACCOUNT_SECTION.legalIdentity),
    label: "Identidade legal",
    icon: IdCard,
  },
  {
    slug: ACCOUNT_SECTION.professionalProfile,
    path: accountSectionPath(ACCOUNT_SECTION.professionalProfile),
    label: "Perfil profissional",
    icon: Briefcase,
  },
  {
    slug: ACCOUNT_SECTION.receivables,
    path: accountSectionPath(ACCOUNT_SECTION.receivables),
    label: "Recebimentos",
    icon: Banknote,
  },
  {
    slug: ACCOUNT_SECTION.earnings,
    path: accountSectionPath(ACCOUNT_SECTION.earnings),
    label: "Ganhos",
    icon: Wallet,
  },
  ...SHARED_FOOTER,
];

export function getAccountNavItems(role: ProfileRole): AccountNavItem[] {
  return role === "provider" ? PROVIDER_ITEMS : CLIENT_ITEMS;
}

/** Labels for mobile stack chrome. */
export const ACCOUNT_SECTION_STACK_TITLE: Record<AccountSectionSlug, string> = {
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

export const CLIENT_ONLY_SECTIONS: AccountSectionSlug[] = [
  ACCOUNT_SECTION.addresses,
  ACCOUNT_SECTION.payments,
];

export const PROVIDER_ONLY_SECTIONS: AccountSectionSlug[] = [
  ACCOUNT_SECTION.legalIdentity,
  ACCOUNT_SECTION.professionalProfile,
  ACCOUNT_SECTION.receivables,
  ACCOUNT_SECTION.earnings,
];
