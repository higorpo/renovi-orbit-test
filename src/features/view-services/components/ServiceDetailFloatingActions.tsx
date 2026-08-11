import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ServiceDetailFloatingActionsProps {
  hasExistingChat: boolean;
  isInsideSheet?: boolean;
  isOpeningChat?: boolean;
  onOpenChat: () => void;
}

export function ServiceDetailFloatingActions({
  hasExistingChat,
  isInsideSheet = false,
  isOpeningChat = false,
  onOpenChat,
}: ServiceDetailFloatingActionsProps) {
  // Deprecated: prefer ServiceNextStepCard as primary CTA; remove when next-step covers this surface.
  const mobileLabel = hasExistingChat ? "Ver negociação >" : "Iniciar negociação >";
  const ariaLabel = hasExistingChat
    ? "Visualizar negociação com o cliente"
    : "Iniciar negociação com o cliente";

  const floatingActionButtonClassName =
    "bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover";

  return (
    <div
      className={cn(
        "fixed right-4 z-40 flex items-center gap-2 md:hidden",
        isInsideSheet
          ? "bottom-[calc(env(safe-area-inset-bottom)+1rem)]"
          : "bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]",
      )}
    >
      <span
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm",
          floatingActionButtonClassName,
        )}
      >
        {mobileLabel}
      </span>
      <Button
        type="button"
        variant="default"
        size="icon"
        className={cn(
          "h-14 w-14 rounded-full transition-transform duration-fast ease-prestway active:scale-[0.97]",
          floatingActionButtonClassName,
        )}
        aria-label={ariaLabel}
        disabled={isOpeningChat}
        onClick={onOpenChat}
      >
        <MessageCircle className="h-6 w-6" aria-hidden />
      </Button>
    </div>
  );
}
