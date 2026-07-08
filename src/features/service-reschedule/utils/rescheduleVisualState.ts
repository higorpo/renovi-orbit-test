import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import type { ServiceRescheduleRequestStatus } from "../types/serviceReschedule.types";

const RESCHEDULE_STATUS_SURFACE: Record<ServiceRescheduleRequestStatus, string> = {
  REQUESTED: "border-border/70 bg-card",
  PROPOSED: "border-primary/20 bg-primary-soft/40",
  ADJUSTMENT_REQUESTED: "border-amber-600/35 bg-amber-500/5",
  ACCEPTED: "border-emerald-600/25 bg-emerald-500/5",
  CANCELLED: "border-muted-foreground/25 bg-muted/40",
  EXPIRED: "border-muted-foreground/25 bg-muted/40",
  SUPERSEDED: "border-muted-foreground/25 bg-muted/40",
};

export function getRescheduleCardSurfaceClass(status: ServiceRescheduleRequestStatus): string {
  return RESCHEDULE_STATUS_SURFACE[status];
}

export function getRescheduleStatusIcon(status: ServiceRescheduleRequestStatus): LucideIcon {
  switch (status) {
    case "ACCEPTED":
      return CheckCircle2;
    case "CANCELLED":
    case "EXPIRED":
    case "SUPERSEDED":
      return XCircle;
    case "ADJUSTMENT_REQUESTED":
      return CircleDot;
    case "PROPOSED":
      return CalendarClock;
    case "REQUESTED":
    default:
      return Clock;
  }
}
