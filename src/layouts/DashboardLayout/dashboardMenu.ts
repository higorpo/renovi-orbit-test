import {
  Briefcase,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProfileRole } from "@/features/auth";
import { ROUTE_SETTINGS } from "@/features/settings/constants/routes";

export interface DashboardMenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Main items shown in mobile bottom nav (first N from allItems). */
const CLIENT_MAIN_COUNT = 4;
const PROVIDER_MAIN_COUNT = 5;

function clientMenuItems(): DashboardMenuItem[] {
  return [
    { path: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
    { path: "/dashboard/services", label: "Meus Serviços", icon: FileText },
    { path: "/dashboard/chats", label: "Conversas", icon: MessageSquare },
    { path: ROUTE_SETTINGS, label: "Configurações", icon: Settings },
  ];
}

function providerMenuItems(): DashboardMenuItem[] {
  return [
    { path: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
    { path: "/dashboard/services", label: "Meus Serviços", icon: FileText },
    { path: "/dashboard/jobs", label: "Trabalhos", icon: Briefcase },
    { path: "/dashboard/chats", label: "Conversas", icon: MessageSquare },
    { path: ROUTE_SETTINGS, label: "Configurações", icon: Settings },
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
