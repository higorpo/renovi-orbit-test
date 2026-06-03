import { ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { ProfileRole } from "@/features/auth";
import { cn } from "@/lib/utils";
import { metrics } from "@/lib/sentry";
import { useProposalTimelineHydration } from "../../hooks/useProposalTimelineHydration";
import type { ChatMessageListItem } from "../../types/chats.types";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  CHAT_INTERACTIVE_FOCUS,
  CHAT_MIN_TOUCH_TARGET,
  getProposalCardSurfaceClass,
  getProposalStatusIcon,
} from "../../utils/conversationVisualState";
import {
  resolveProposalCardCtas,
  resolveProposalCardDescription,
  resolveProposalCardDetailsLabel,
  resolveProposalCardHeadline,
  type ProposalCardCta,
} from "../../utils/proposalCardCopy";

export type ProposalCardAction = ProposalCardCta["id"] | "view_details";

export interface DynamicProposalCardProps {
  chatId: string;
  message: ChatMessageListItem;
  viewerRole: ProfileRole;
  isOutgoing: boolean;
  onProposalAction?: (action: ProposalCardAction, proposalId: string) => void;
  className?: string;
}

export function DynamicProposalCard({
  chatId,
  message,
  viewerRole,
  isOutgoing,
  onProposalAction,
  className,
}: DynamicProposalCardProps) {
  const proposalId = message.linked_entity_id;

  const { proposal } = useProposalTimelineHydration(chatId, proposalId, Boolean(proposalId));

  const status = proposal?.status ?? "PENDING";
  const headline = resolveProposalCardHeadline(status);
  const description = resolveProposalCardDescription(status, viewerRole);
  const detailsLabel = resolveProposalCardDetailsLabel(status, viewerRole);
  const ctas = resolveProposalCardCtas(status, viewerRole);
  const StatusIcon = getProposalStatusIcon(status);

  useEffect(() => {
    metrics.count("chats.dynamic_proposal_card_render", 1, {
      status: String(status),
    });
  }, [status]);

  if (!proposalId) {
    return (
      <div className={cn("rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground", className)}>
        Não foi possível vincular esta proposta à conversa.
      </div>
    );
  }

  return (
    <article
      className={cn(
        "w-full max-w-[88%] rounded-2xl border px-4 py-4 shadow-sm",
        getProposalCardSurfaceClass(status),
        isOutgoing ? "ml-auto" : "mr-auto",
        className,
      )}
      aria-label={headline}
    >
      <div className="flex items-start gap-2">
        <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{headline}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          {proposal?.proposed_amount ? (
            <p className="text-base font-semibold text-foreground">
              {formatCurrency(proposal.proposed_amount)}
            </p>
          ) : null}
        </div>
      </div>

      {ctas.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {ctas.map((cta) => (
            <Button
              key={cta.id}
              type="button"
              size="sm"
              variant={cta.variant}
              className={cn(
                "rounded-full px-4",
                CHAT_MIN_TOUCH_TARGET,
                CHAT_INTERACTIVE_FOCUS,
                cta.id === "accept" && "font-semibold",
              )}
              onClick={() => onProposalAction?.(cta.id, proposalId)}
            >
              {cta.label}
            </Button>
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "mt-3 w-full justify-between rounded-xl px-3",
          CHAT_MIN_TOUCH_TARGET,
          CHAT_INTERACTIVE_FOCUS,
        )}
        onClick={() => onProposalAction?.("view_details", proposalId)}
      >
        {detailsLabel}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </article>
  );
}
