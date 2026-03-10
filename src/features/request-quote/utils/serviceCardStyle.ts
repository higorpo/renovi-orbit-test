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
} from "lucide-react";

export interface ServiceCardStyle {
  Icon: LucideIcon;
  color: string;
}

const SLUG_TO_STYLE: Record<string, ServiceCardStyle> = {
  climatizacao: { Icon: Wind, color: "from-sky-400 to-indigo-500" },
  eletricista: { Icon: Zap, color: "from-yellow-500 to-orange-500" },
  "instalacao-eletrica": { Icon: Zap, color: "from-yellow-500 to-orange-500" },
  encanador: { Icon: Droplet, color: "from-cyan-500 to-blue-500" },
  hidraulica: { Icon: Droplet, color: "from-cyan-500 to-blue-500" },
  marceneiro: { Icon: Ruler, color: "from-amber-700 to-orange-700" },
  montador: { Icon: Wrench, color: "from-green-500 to-teal-500" },
  "montador-moveis": { Icon: Wrench, color: "from-green-500 to-teal-500" },
  pedreiro: { Icon: Hammer, color: "from-gray-600 to-gray-800" },
  pintor: { Icon: Paintbrush, color: "from-blue-500 to-purple-500" },
  pintura: { Icon: Paintbrush, color: "from-blue-500 to-purple-500" },
  reparos: { Icon: Settings, color: "from-slate-500 to-slate-700" },
  "reparos-gerais": { Icon: Settings, color: "from-slate-500 to-slate-700" },
};

const DEFAULT_STYLE: ServiceCardStyle = {
  Icon: Wrench,
  color: "from-slate-500 to-slate-700",
};

export function getServiceCardStyle(slug: string): ServiceCardStyle {
  const normalized = slug.toLowerCase().trim();
  return SLUG_TO_STYLE[normalized] ?? DEFAULT_STYLE;
}

export const SERVICE_PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%231e3a5f'/%3E%3Cstop offset='100%25' style='stop-color:%232d5a87'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23g)' width='400' height='300'/%3E%3Cpath d='M200 120l-40 50h80l-40-50z' fill='none' stroke='%23c57a3a' stroke-width='3' stroke-linejoin='round'/%3E%3Ccircle cx='200' cy='140' r='20' fill='none' stroke='%23c57a3a' stroke-width='2'/%3E%3Ctext fill='%23f8fafc' font-family='sans-serif' font-size='14' x='200' y='220' text-anchor='middle'%3EServiço%3C/text%3E%3C/svg%3E";
