import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  MessageCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import type { StatusTabId } from "./statusTabs";

export interface StatusTabDisplayConfig {
  Icon: LucideIcon;
  /** Tailwind text color class for the icon when active. */
  iconColor: string;
  /** Optional bg tint when tab is selected. */
  activeBg?: string;
}

export const STATUS_TAB_DISPLAY: Record<StatusTabId, StatusTabDisplayConfig> = {
  all: {
    Icon: LayoutGrid,
    iconColor: "text-muted-foreground",
    activeBg: "bg-muted",
  },
  negotiation: {
    Icon: MessageCircle,
    iconColor: "text-orange-600",
    activeBg: "bg-orange-500/10",
  },
  in_progress: {
    Icon: Loader2,
    iconColor: "text-blue-600",
    activeBg: "bg-blue-500/10",
  },
  completed: {
    Icon: CheckCircle2,
    iconColor: "text-green-600",
    activeBg: "bg-green-500/10",
  },
  cancelled: {
    Icon: XCircle,
    iconColor: "text-gray-500",
    activeBg: "bg-gray-500/10",
  },
  dispute: {
    Icon: AlertTriangle,
    iconColor: "text-red-600",
    activeBg: "bg-red-500/10",
  },
};
