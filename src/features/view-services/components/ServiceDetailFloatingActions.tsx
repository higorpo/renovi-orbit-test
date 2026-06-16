import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SERVICE_DETAIL_PAGE_MAX_WIDTH_CLASS } from "../constants/serviceDetail.constants";

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
  const desktopLabel = hasExistingChat
    ? "Visualizar negociação com o cliente"
    : "Iniciar negociação com o cliente";
  const mobileLabel = hasExistingChat ? "Ver negociação >" : "Iniciar negociação >";
  const ariaLabel = hasExistingChat
    ? "Visualizar negociação com o cliente"
    : "Iniciar negociação com o cliente";

  const floatingActionButtonClassName =
    "bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover";

  return (
    <>
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
            "h-14 w-14 rounded-full transition-transform duration-fast ease-renovi active:scale-[0.97]",
            floatingActionButtonClassName,
          )}
          aria-label={ariaLabel}
          disabled={isOpeningChat}
          onClick={onOpenChat}
        >
          <MessageCircle className="h-6 w-6" aria-hidden />
        </Button>
      </div>

      <div
        className={cn(
          "fixed bottom-5 z-40 hidden rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 md:block",
          isInsideSheet
            ? "right-4 w-[calc(100%-2rem)] sm:w-[calc(36rem-2rem)] md:w-[calc(42rem-2rem)] lg:w-[calc(48rem-2rem)]"
            : cn("left-1/2 w-[calc(100%-2rem)] -translate-x-1/2", SERVICE_DETAIL_PAGE_MAX_WIDTH_CLASS),
        )}
      >
        <Button
          type="button"
          variant="default"
          className={cn(
            "w-full gap-2 rounded-pill transition-transform duration-fast ease-renovi active:scale-[0.97]",
            floatingActionButtonClassName,
          )}
          disabled={isOpeningChat}
          onClick={onOpenChat}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {desktopLabel}
        </Button>
      </div>
    </>
  );
}
