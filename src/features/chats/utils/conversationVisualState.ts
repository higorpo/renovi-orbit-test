import {
  CheckCircle2,
  Circle,
  CircleOff,
  Clock,
  Lock,
  type LucideIcon,
  XCircle,
} from "lucide-react";
import type { CnsConversationStatus } from "../types/chats.types";

/** Tailwind tokens for conversation FSM (Req. 20, R20-AC01). */
export const CONVERSATION_STATUS_TOKENS = {
  ACTIVE: {
    label: "Ativa",
    listDim: "",
    badge: "border-primary/30 bg-primary/10 text-primary",
  },
  INACTIVE: {
    label: "Inativa",
    listDim: "opacity-80 saturate-[0.85]",
    badge: "border-muted-foreground/35 bg-muted text-muted-foreground",
  },
  CLOSED: {
    label: "Encerrada",
    listDim: "opacity-70 saturate-[0.75]",
    badge: "border-border bg-muted/70 text-muted-foreground",
  },
} as const satisfies Record<
  CnsConversationStatus,
  { label: string; listDim: string; badge: string }
>;

export interface ConversationStatusPresentation {
  label: string;
  Icon: LucideIcon;
  listItemClassName: string;
  badgeClassName: string;
  showInList: boolean;
}

export function getConversationStatusPresentation(
  status: CnsConversationStatus,
): ConversationStatusPresentation {
  const tokens = CONVERSATION_STATUS_TOKENS[status];

  switch (status) {
    case "ACTIVE":
      return {
        label: tokens.label,
        Icon: Circle,
        listItemClassName: tokens.listDim,
        badgeClassName: tokens.badge,
        showInList: false,
      };
    case "INACTIVE":
      return {
        label: tokens.label,
        Icon: CircleOff,
        listItemClassName: tokens.listDim,
        badgeClassName: tokens.badge,
        showInList: true,
      };
    case "CLOSED":
      return {
        label: tokens.label,
        Icon: Lock,
        listItemClassName: tokens.listDim,
        badgeClassName: tokens.badge,
        showInList: true,
      };
    default:
      return {
        label: tokens.label,
        Icon: Circle,
        listItemClassName: "",
        badgeClassName: tokens.badge,
        showInList: false,
      };
  }
}

/** Proposal card surface tokens (R20-AC02) — status must not rely on color alone (icon + text in card). */
export const PROPOSAL_STATUS_SURFACE: Record<string, string> = {
  PENDING: "border-primary/35 bg-card shadow-sm",
  ACCEPTED: "border-emerald-600/40 bg-emerald-500/5",
  REJECTED: "border-destructive/35 bg-destructive/5",
  REJECTED_AUTOMATICALLY: "border-destructive/35 bg-destructive/5",
  EXPIRED: "border-muted-foreground/25 bg-muted/40",
  REVISION_REQUESTED: "border-amber-600/35 bg-amber-500/5",
  REVISED: "border-destructive/35 bg-destructive/5",
};

export function getProposalCardSurfaceClass(status: string): string {
  return PROPOSAL_STATUS_SURFACE[status] ?? "border-border/70 bg-card";
}

export function getProposalStatusIcon(status: string): LucideIcon {
  switch (status) {
    case "ACCEPTED":
      return CheckCircle2;
    case "EXPIRED":
      return Clock;
    case "REJECTED":
    case "REJECTED_AUTOMATICALLY":
    case "REVISED":
      return XCircle;
    case "PENDING":
      return Clock;
    default:
      return Circle;
  }
}

export const CHAT_INTERACTIVE_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const CHAT_MIN_TOUCH_TARGET = "min-h-11 min-w-11";
