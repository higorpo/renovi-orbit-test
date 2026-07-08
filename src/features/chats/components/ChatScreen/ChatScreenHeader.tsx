import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";
import type { CnsConversationStatus } from "../../types/chats.types";
import { ConversationStatusBadge } from "../ConversationStatusBadge/ConversationStatusBadge";
import { getConversationStatusPresentation } from "../../utils/conversationVisualState";
import { initialsFromName } from "@/lib/utils/initialsFromName";

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
      {initialsFromName(counterpartyName)}
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
      <p className={cn("text-muted-foreground", serviceClassName)}>{serviceTitle}</p>
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
      variant="ghost"
      className={cn(
        "h-8 min-h-8 shrink-0 rounded-full border border-border/50 bg-muted/70 px-3 text-xs font-medium text-foreground shadow-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
  const isOnline = useOnlineStatus();
  const statusPresentation = conversationStatus
    ? getConversationStatusPresentation(conversationStatus)
    : null;
  const showStatusBadge = statusPresentation?.showInList ?? false;
  const mobileTopInsetClass = isOnline
    ? "pt-[max(0.75rem,env(safe-area-inset-top))]"
    : "pt-3";
  const mobileActionTopClass = isOnline
    ? "top-[max(0.75rem,env(safe-area-inset-top))]"
    : "top-3";

  return (
    <header
      className={cn(
        "relative w-full min-w-0 shrink-0 overflow-hidden border-b border-border/60 bg-background",
        statusPresentation?.listItemClassName,
        className,
      )}
    >
      {/* Mobile: centered identity + back row */}
      <div
        className={cn("relative px-4 pb-3 md:hidden", mobileTopInsetClass)}
        data-testid="chat-header-mobile"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "absolute left-0 z-10 h-10 w-10 -translate-y-2 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-transparent hover:text-primary",
            mobileActionTopClass,
          )}
          onClick={onBack}
          aria-label="Voltar"
        >
          <ArrowLeft className="!h-6 !w-6" aria-hidden />
        </Button>

        {onDetails ? (
          <DetailsButton
            onClick={onDetails}
            className={cn("absolute right-4 z-10", mobileActionTopClass)}
          />
        ) : null}

        <div className="flex flex-col items-center px-11 text-center">
          <CounterpartyAvatar
            counterpartyName={counterpartyName}
            className="h-10 w-10 text-[11px]"
          />
          <div className="mt-1">
            <IdentityCopy
              counterpartyName={counterpartyName}
              serviceTitle={serviceTitle}
              nameClassName="text-sm"
              serviceClassName="mt-0 line-clamp-2 text-[13px] leading-snug"
            />
          </div>
          {showStatusBadge && conversationStatus ? (
            <div className="mt-1">
              <ConversationStatusBadge status={conversationStatus} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Desktop: horizontal identity + actions on the right */}
      <div
        className="hidden min-w-0 w-full items-center justify-between gap-3 px-4 py-3 md:flex"
        data-testid="chat-header-desktop"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden pr-2">
          <CounterpartyAvatar counterpartyName={counterpartyName} className="h-12 w-12 text-base" />
          <div className="min-w-0 flex-1 overflow-hidden text-left">
            <IdentityCopy
              counterpartyName={counterpartyName}
              serviceTitle={serviceTitle}
              nameClassName="truncate text-base"
              serviceClassName="mt-0.5 truncate text-sm"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showStatusBadge && conversationStatus ? (
            <ConversationStatusBadge status={conversationStatus} />
          ) : null}
          {onDetails ? <DetailsButton onClick={onDetails} /> : null}
        </div>
      </div>
    </header>
  );
}
