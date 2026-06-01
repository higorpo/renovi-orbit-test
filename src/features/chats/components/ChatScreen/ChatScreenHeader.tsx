import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CnsConversationStatus } from "../../types/chats.types";
import { ConversationStatusBadge } from "../ConversationStatusBadge/ConversationStatusBadge";
import { getConversationStatusPresentation } from "../../utils/conversationVisualState";
import { getCounterpartyInitials } from "../../utils/getCounterpartyInitials";

export interface ChatScreenHeaderProps {
  counterpartyName: string;
  serviceTitle: string;
  conversationStatus?: CnsConversationStatus | null;
  onBack: () => void;
  onDetails?: () => void;
  className?: string;
}

export function ChatScreenHeader({
  counterpartyName,
  serviceTitle,
  conversationStatus,
  onBack,
  onDetails,
  className,
}: ChatScreenHeaderProps) {
  const statusPresentation = conversationStatus
    ? getConversationStatusPresentation(conversationStatus)
    : null;

  return (
    <header
      className={cn(
        "relative shrink-0 border-b border-border/60 bg-background px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))]",
        statusPresentation?.listItemClassName,
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={onBack}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Button>

        {onDetails ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 rounded-full px-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={onDetails}
          >
            Detalhes
          </Button>
        ) : (
          <span className="w-11" aria-hidden />
        )}
      </div>

      <div className="mt-2 flex flex-col items-center text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground shadow-sm"
          aria-hidden
        >
          {getCounterpartyInitials(counterpartyName)}
        </div>
        <h1 className="mt-2 text-lg font-semibold leading-tight text-foreground">{counterpartyName}</h1>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{serviceTitle}</p>
        {conversationStatus ? (
          <div className="mt-2">
            <ConversationStatusBadge status={conversationStatus} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
