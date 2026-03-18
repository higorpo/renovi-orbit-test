import {
  Briefcase,
  FileText,
  HelpCircle,
  LayoutDashboard,
  MapPin,
  Settings,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProfileRole } from "@/features/auth";

export interface DashboardMenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Main items shown in mobile bottom nav (first N from allItems). */
const CLIENT_MAIN_COUNT = 4;
const PROVIDER_MAIN_COUNT = 4;

function clientMenuItems(): DashboardMenuItem[] {
  return [
    { path: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
    { path: "/dashboard/requests", label: "Meus Serviços", icon: FileText },
    { path: "/dashboard/addresses", label: "Endereços", icon: MapPin },
    { path: "/dashboard/conta", label: "Minha conta", icon: Settings },
    { path: "/dashboard/help", label: "Ajuda", icon: HelpCircle },
  ];
}

function providerMenuItems(): DashboardMenuItem[] {
  return [
    { path: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
    { path: "/dashboard/requests", label: "Solicitações", icon: FileText },
    { path: "/dashboard/jobs", label: "Trabalhos", icon: Briefcase },
    { path: "/dashboard/earnings", label: "Ganhos", icon: Wallet },
    { path: "/dashboard/conta", label: "Minha conta", icon: Settings },
    { path: "/dashboard/help", label: "Ajuda", icon: HelpCircle },
  ];
}

export interface DashboardMenuConfig {
  mainItems: DashboardMenuItem[];
  allItems: DashboardMenuItem[];
}

export function getDashboardMenu(role: ProfileRole): DashboardMenuConfig {
  const allItems = role === "client" ? clientMenuItems() : providerMenuItems();
  const mainCount = role === "client" ? CLIENT_MAIN_COUNT : PROVIDER_MAIN_COUNT;
  const mainItems = allItems.slice(0, mainCount);
  return { mainItems, allItems };
}
