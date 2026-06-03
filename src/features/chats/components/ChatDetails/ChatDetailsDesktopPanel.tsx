import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/features/auth";
import { cn } from "@/lib/utils";
import type { ConversationDetailResponse } from "../../types/chats.types";
import { ChatDetailsPanel } from "./ChatDetailsPanel";

export interface ChatDetailsDesktopPanelProps {
  detail: ConversationDetailResponse;
  currentUser: Profile;
  onClose: () => void;
  onArchive: () => void;
  isArchiving?: boolean;
  className?: string;
}

export function ChatDetailsDesktopPanel({
  detail,
  currentUser,
  onClose,
  onArchive,
  isArchiving = false,
  className,
}: ChatDetailsDesktopPanelProps) {
  return (
    <aside
      data-testid="chat-details-desktop-panel"
      className={cn(
        "hidden min-h-0 w-[360px] shrink-0 flex-col border-l border-border/60 bg-background md:flex",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3.5">
        <h1 className="text-base font-semibold text-foreground">Detalhes</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={onClose}
          aria-label="Fechar detalhes"
        >
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
        <ChatDetailsPanel
          detail={detail}
          currentUser={currentUser}
          onArchive={onArchive}
          isArchiving={isArchiving}
        />
      </div>
    </aside>
  );
}
