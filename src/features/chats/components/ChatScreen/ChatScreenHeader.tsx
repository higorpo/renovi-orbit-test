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

function CounterpartyAvatar({
  counterpartyName,
  className,
}: {
  counterpartyName: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden
    >
      {getCounterpartyInitials(counterpartyName)}
    </div>
  );
}

function IdentityCopy({
  counterpartyName,
  serviceTitle,
  nameClassName,
  serviceClassName,
}: {
  counterpartyName: string;
  serviceTitle: string;
  nameClassName?: string;
  serviceClassName?: string;
}) {
  return (
    <>
      <h1 className={cn("font-semibold leading-tight text-foreground", nameClassName)}>
        {counterpartyName}
      </h1>
      <p className={cn("line-clamp-2 text-muted-foreground", serviceClassName)}>{serviceTitle}</p>
    </>
  );
}

function DetailsButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn(
        "min-h-11 shrink-0 rounded-full px-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      onClick={onClick}
    >
      Detalhes
    </Button>
  );
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
        "relative shrink-0 border-b border-border/60 bg-background",
        statusPresentation?.listItemClassName,
        className,
      )}
    >
      {/* Mobile: centered identity + back row */}
      <div
        className="px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden"
        data-testid="chat-header-mobile"
      >
        <div className="flex items-start justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 -mt-[10px] shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-transparent hover:text-primary"
            onClick={onBack}
            aria-label="Voltar"
          >
            <ArrowLeft className="!h-6 !w-6" aria-hidden />
          </Button>

          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <CounterpartyAvatar
              counterpartyName={counterpartyName}
              className="h-10 w-10 text-[11px]"
            />
            <div className="mt-1">
              <IdentityCopy
                counterpartyName={counterpartyName}
                serviceTitle={serviceTitle}
                nameClassName="text-sm"
                serviceClassName="mt-0 text-[13px] leading-snug"
              />
            </div>
            {conversationStatus ? (
              <div className="mt-1">
                <ConversationStatusBadge status={conversationStatus} />
              </div>
            ) : null}
          </div>

          {onDetails ? (
            <DetailsButton
              onClick={onDetails}
              className="min-h-11 px-3 text-[11px]"
            />
          ) : (
            <span className="w-11 shrink-0" aria-hidden />
          )}
        </div>
      </div>

      {/* Desktop: horizontal identity + actions on the right */}
      <div
        className="hidden items-center justify-between gap-4 px-4 py-3 md:flex"
        data-testid="chat-header-desktop"
      >
        <div className="flex min-w-0 items-center gap-3">
          <CounterpartyAvatar counterpartyName={counterpartyName} className="h-12 w-12 text-base" />
          <div className="min-w-0 text-left">
            <IdentityCopy
              counterpartyName={counterpartyName}
              serviceTitle={serviceTitle}
              nameClassName="truncate text-base"
              serviceClassName="mt-0.5 truncate text-sm"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {conversationStatus ? <ConversationStatusBadge status={conversationStatus} /> : null}
          {onDetails ? <DetailsButton onClick={onDetails} /> : null}
        </div>
      </div>
    </header>
  );
}
