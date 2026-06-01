import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  resolveProposalCardHeadline,
  type ProposalCardCta,
} from "../../utils/proposalCardCopy";
import { useChatTimelineScrollContext } from "../ChatScreen/ChatTimelineScrollContext";

export type ProposalCardAction = ProposalCardCta["id"];

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
  const scrollContext = useChatTimelineScrollContext();
  const proposalId = message.linked_entity_id;
  const [isExpanded, setIsExpanded] = useState(false);

  const { proposal, isLoading, isError, refetch } = useProposalTimelineHydration(
    chatId,
    proposalId,
    isExpanded,
  );

  const status = proposal?.status ?? "PENDING";
  const headline = resolveProposalCardHeadline(status);
  const description = resolveProposalCardDescription(status, viewerRole);
  const ctas = resolveProposalCardCtas(status, viewerRole);
  const StatusIcon = getProposalStatusIcon(status);

  useEffect(() => {
    metrics.count("chats.dynamic_proposal_card_render", 1, {
      status: String(status),
      expanded: isExpanded ? "true" : "false",
    });
  }, [isExpanded, status]);

  const handleToggleExpand = () => {
    scrollContext?.preserveScrollOnLayoutShift();
    setIsExpanded((current) => !current);
  };

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
        </div>
      </div>

      {isExpanded && isLoading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando detalhes da proposta…
        </div>
      ) : null}

      {isExpanded && proposal ? (
        <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-3">
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(proposal.proposed_amount)}
          </p>
          <p className="text-xs text-muted-foreground">Versão {proposal.version}</p>
        </div>
      ) : null}

      {isExpanded && isError ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar as informações da proposta.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {isExpanded && proposal?.proposal_description ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {proposal.proposal_description}
        </p>
      ) : null}

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
        onClick={handleToggleExpand}
        aria-expanded={isExpanded}
      >
        {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
          aria-hidden
        />
      </Button>
    </article>
  );
}
