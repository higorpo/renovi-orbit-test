import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Profile } from "@/features/auth";
import { cn } from "@/lib/utils";
import type { ConversationDetailResponse } from "../../types/chats.types";
import { ChatDetailsPanel } from "./ChatDetailsPanel";

export interface ChatDetailsMobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ConversationDetailResponse | null;
  currentUser: Profile | null;
  onArchive: () => void;
  isArchiving?: boolean;
}

export function ChatDetailsMobileSheet({
  open,
  onOpenChange,
  detail,
  currentUser,
  onArchive,
  isArchiving = false,
}: ChatDetailsMobileSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        data-testid="chat-details-mobile-sheet"
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 rounded-t-2xl p-0",
          "[&>button]:right-4 [&>button]:top-4",
        )}
      >
        <div
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted"
          aria-hidden
        />

        <SheetHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-14 text-left">
          <SheetTitle className="text-lg font-semibold">Mais informações</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {detail && currentUser ? (
            <ChatDetailsPanel
              detail={detail}
              currentUser={currentUser}
              onArchive={onArchive}
              isArchiving={isArchiving}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
