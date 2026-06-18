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
    id: "newest",
    label: "Mais recentes",
    icon: Clock,
    iconColor: "text-amber-500",
  },
  {
    id: "nearest",
    label: "Mais próximos",
    icon: MapPin,
    iconColor: "text-blue-500",
  },
  {
    id: "least_competitive",
    label: "Menos concorridos",
    icon: Users,
    iconColor: "text-emerald-500",
  },
];

/** Default when feed GPS is unavailable (Req 13.4). */
export const DEFAULT_SORT_MODE_WITHOUT_GPS: SortMode = "newest";

/** Default when feed GPS is available (Req 13.5). */
export const DEFAULT_SORT_MODE_WITH_GPS: SortMode = "nearest";

/** Initial filter state before GPS resolves. */
export const DEFAULT_SORT_MODE: SortMode = DEFAULT_SORT_MODE_WITHOUT_GPS;

export function getDefaultSortMode(hasFeedGps: boolean): SortMode {
  return hasFeedGps ? DEFAULT_SORT_MODE_WITH_GPS : DEFAULT_SORT_MODE_WITHOUT_GPS;
}

export function getVisibleSortModes(hasFeedGps: boolean): SortModeConfig[] {
  if (hasFeedGps) {
    return SORT_MODES;
  }
  return SORT_MODES.filter((mode) => mode.id !== "nearest");
}

export function isSortModeAllowed(mode: SortMode, hasFeedGps: boolean): boolean {
  if (mode === "nearest") {
    return hasFeedGps;
  }
  return true;
}
