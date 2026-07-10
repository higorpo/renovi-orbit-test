import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProposalCopyVariant } from "../constants/proposalCopyVariants";
import { useProposalCountdown } from "../hooks/useProposalCountdown";
import type { ProposalStatus } from "../types/proposals.types";
import {
  resolveProposalCountdownCopy,
  type ProposalCountdownAudience,
} from "../utils/proposalCountdownCopy";
import {
  DEFAULT_PROPOSAL_RESPONSE_SLA_HOURS,
  resolveProposalExpiresAt,
} from "../utils/proposalCountdown";

export interface ProposalCountdownBannerProps {
  status: ProposalStatus | string | null;
  /** Prefer server `expires_at` from get_proposal_detail_*. */
  expiresAt?: string | null;
  /** Fallback when API has not provided expires_at (e.g. budget compare select). */
  submittedAt?: string | null;
  audience: ProposalCountdownAudience;
  copyVariant?: ProposalCopyVariant;
  enabled?: boolean;
  density?: "default" | "compact";
  className?: string;
}

export function ProposalCountdownBanner({
  status,
  expiresAt = null,
  submittedAt = null,
  audience,
  copyVariant = "proposal",
  enabled = true,
  density = "default",
  className,
}: ProposalCountdownBannerProps) {
  const resolvedExpiresAt =
    expiresAt ??
    resolveProposalExpiresAt({
      submittedAt,
      slaHours: DEFAULT_PROPOSAL_RESPONSE_SLA_HOURS,
    })?.toISOString() ??
    null;

  const countdown = useProposalCountdown({
    status: status as ProposalStatus | null,
    expiresAt: resolvedExpiresAt,
    enabled,
  });

  const copy = resolveProposalCountdownCopy({
    audience,
    copyVariant,
    snapshot: countdown,
    density,
  });

  if (!copy) return null;

  const isWarning = countdown.isWarning || countdown.isExpired;

  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border px-3 py-2 text-sm",
        density === "compact" ? "rounded-xl" : "rounded-md",
        isWarning
          ? "border-amber-200/80 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30"
          : "border-border bg-muted/30",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Clock
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isWarning ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p
          className={cn(
            "font-medium",
            isWarning ? "text-amber-900 dark:text-amber-100" : "text-foreground",
            density === "compact" && "text-xs",
          )}
        >
          {copy.title}
        </p>
        <p
          className={cn(
            "text-muted-foreground",
            density === "compact" ? "text-xs" : "text-sm",
          )}
        >
          {copy.body}
        </p>
      </div>
    </div>
  );
}
