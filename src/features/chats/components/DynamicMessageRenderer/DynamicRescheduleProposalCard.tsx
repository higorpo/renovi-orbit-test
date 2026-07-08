import type { ProfileRole } from "@/features/auth";
import {
  formatRescheduleSlot,
  resolveRescheduleCardCtas,
  resolveRescheduleCardDescription,
  resolveRescheduleCardHeadline,
  type RescheduleCardCtaId,
  useRescheduleTimelineHydration,
} from "@/features/service-reschedule";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessageListItem } from "../../types/chats.types";
import { CHAT_INTERACTIVE_FOCUS, CHAT_MIN_TOUCH_TARGET } from "../../utils/conversationVisualState";

export type RescheduleCardAction = RescheduleCardCtaId;

export interface DynamicRescheduleProposalCardProps {
  chatId: string;
  message: ChatMessageListItem;
  viewerRole: ProfileRole;
  isOutgoing: boolean;
  onRescheduleAction?: (action: RescheduleCardAction, requestId: string) => void;
  className?: string;
}

export function DynamicRescheduleProposalCard({
  chatId,
  message,
  viewerRole,
  isOutgoing,
  onRescheduleAction,
  className,
}: DynamicRescheduleProposalCardProps) {
  const requestId = message.linked_entity_id;
  const { snapshot, isLoading } = useRescheduleTimelineHydration(
    chatId,
    requestId,
    Boolean(requestId),
  );

  const activeRequest = snapshot?.activeRequest;
  const status = activeRequest?.status ?? "PROPOSED";
  const headline = resolveRescheduleCardHeadline(status, viewerRole);
  const description = resolveRescheduleCardDescription(status, viewerRole);
  const proposedSlot =
    activeRequest?.proposed_slot ??
    (message.payload?.slot as { start_date?: string; end_date?: string | null; shift?: string } | undefined);

  const ctas = resolveRescheduleCardCtas(status, viewerRole, {
    canPropose: Boolean(snapshot?.canProposeReschedule),
    canAccept: Boolean(snapshot?.canAcceptReschedule),
    canRequestAdjustment: Boolean(snapshot?.canRequestAdjustment),
    canCancel: Boolean(snapshot?.canCancelReschedule),
  });

  if (!requestId) {
    return (
      <div className={cn("rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground", className)}>
        Não foi possível vincular esta solicitação de reagendamento.
      </div>
    );
  }

  if (isLoading && !snapshot) {
    return (
      <div className={cn("h-28 animate-pulse rounded-2xl border bg-muted/40", className)} aria-hidden />
    );
  }

  return (
    <article
      className={cn(
        "w-full max-w-[88%] rounded-2xl border border-primary/20 bg-primary-soft/40 px-4 py-4 shadow-sm",
        isOutgoing ? "ml-auto" : "mr-auto",
        className,
      )}
      aria-label={headline}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{headline}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {proposedSlot ? (
          <div className="rounded-lg border border-primary/20 bg-background/70 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Data proposta
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {formatRescheduleSlot(proposedSlot as never)}
            </p>
          </div>
        ) : null}

        {ctas.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {ctas.map((cta) => (
              <Button
                key={cta.id}
                type="button"
                size="sm"
                variant={cta.variant}
                className={cn(CHAT_MIN_TOUCH_TARGET, CHAT_INTERACTIVE_FOCUS, "rounded-full")}
                onClick={() => onRescheduleAction?.(cta.id, requestId)}
              >
                {cta.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
