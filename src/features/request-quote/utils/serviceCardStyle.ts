import type { LucideIcon } from "lucide-react";
import {
  Wind,
  Zap,
  Droplet,
  Ruler,
  Wrench,
  Hammer,
  Paintbrush,
  Settings,
  Brush,
  Building2,
  HardHat,
  PenTool,
  Plug,
  Palette,
  Sparkles,
  ClipboardList,
  Box,
  Truck,
  Home,
  Package,
  PencilRuler,
  Gavel,
  PaintRoller,
  Pickaxe,
  BrickWall,
  Sofa,
  Drill,
  DraftingCompass,
} from "lucide-react";

/** Tailwind gradient classes for service cards (bg-gradient-to-br from-X to-Y). */
export const SERVICE_COLOR_KEYS = {
  sky_indigo: "from-sky-400 to-indigo-500",
  yellow_orange: "from-yellow-500 to-orange-500",
  cyan_blue: "from-cyan-500 to-blue-500",
  amber_orange: "from-amber-700 to-orange-700",
  green_teal: "from-green-500 to-teal-500",
  gray: "from-gray-600 to-gray-800",
  blue_purple: "from-blue-500 to-purple-500",
  slate: "from-slate-500 to-slate-700",
} as const;

export type ServiceColorKey = keyof typeof SERVICE_COLOR_KEYS;

/** Lucide icon names supported in the DB (icon_key). Add new icons here when needed. */
const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Wind,
  Zap,
  Droplet,
  Ruler,
  Wrench,
  Hammer,
  Paintbrush,
  Settings,
  Brush,
  Building2,
  HardHat,
  PenTool,
  Plug,
  Palette,
  Sparkles,
  ClipboardList,
  Box,
  Truck,
  Home,
  Package,
  PencilRuler,
  Gavel,
  PaintRoller,
  Pickaxe,
  BrickWall,
  Sofa,
  Drill,
  DraftingCompass,
};

const DEFAULT_ICON_KEY = "Wrench";
const DEFAULT_COLOR_KEY: ServiceColorKey = "slate";

export interface ServiceCardStyle {
  Icon: LucideIcon;
  color: string;
}

export interface ServiceStyleInput {
  icon_key?: string | null;
  color_key?: string | null;
}

function getIcon(iconKey: string | null | undefined): LucideIcon {
  const key = (iconKey ?? "").trim();
  if (!key) return LUCIDE_ICON_MAP[DEFAULT_ICON_KEY]!;
  return LUCIDE_ICON_MAP[key] ?? LUCIDE_ICON_MAP[DEFAULT_ICON_KEY]!;
}

function getColorClasses(colorKey: string | null | undefined): string {
  const key = (colorKey ?? "").trim();
  if (!key || !(key in SERVICE_COLOR_KEYS)) {
    return SERVICE_COLOR_KEYS[DEFAULT_COLOR_KEY];
  }
  return SERVICE_COLOR_KEYS[key as ServiceColorKey];
}

/**
 * Resolves icon and gradient from service DB fields (icon_key, color_key).
 * Uses defaults when keys are null or invalid.
 */
export function getServiceCardStyle(service: ServiceStyleInput | null | undefined): ServiceCardStyle {
  if (!service) {
    return {
      Icon: LUCIDE_ICON_MAP[DEFAULT_ICON_KEY]!,
      color: SERVICE_COLOR_KEYS[DEFAULT_COLOR_KEY],
    };
  }
  return {
    Icon: getIcon(service.icon_key),
    color: getColorClasses(service.color_key),
  };
}

export const SERVICE_PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%231e3a5f'/%3E%3Cstop offset='100%25' style='stop-color:%232d5a87'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='400' height='300'/%3E%3Cpath d='M200 120l-40 50h80l-40-50z' fill='none' stroke='%23c57a3a' stroke-width='3' stroke-linejoin='round'/%3E%3Ccircle cx='200' cy='140' r='20' fill='none' stroke='%23c57a3a' stroke-width='2'/%3E%3Ctext fill='%23f8fafc' font-family='sans-serif' font-size='14' x='200' y='220' text-anchor='middle'%3EServiço%3C/text%3E%3C/svg%3E";
