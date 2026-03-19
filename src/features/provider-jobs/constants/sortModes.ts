import { MapPin, Clock, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SortMode } from "../types/provider-jobs.types";

export interface SortModeConfig {
  id: SortMode;
  label: string;
  icon: LucideIcon;
  iconColor: string;
}

export const SORT_MODES: SortModeConfig[] = [
  {
    id: "nearest",
    label: "Mais próximos",
    icon: MapPin,
    iconColor: "text-blue-500",
  },
  {
    id: "newest",
    label: "Mais recentes",
    icon: Clock,
    iconColor: "text-amber-500",
  },
  {
    id: "least_competitive",
    label: "Menos concorridos",
    icon: Users,
    iconColor: "text-emerald-500",
  },
];

export const RADIUS_OPTIONS = [2, 5, 10, 20, 50] as const;

export type RadiusOption = (typeof RADIUS_OPTIONS)[number];

export const DEFAULT_RADIUS_KM = 10;
export const DEFAULT_SORT_MODE: SortMode = "nearest";
