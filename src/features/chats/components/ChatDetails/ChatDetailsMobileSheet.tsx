import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
  onViewProposalDetails?: (proposalId: string) => void;
  isArchiving?: boolean;
}

export function ChatDetailsMobileSheet({
  open,
  onOpenChange,
  detail,
  currentUser,
  onArchive,
  onViewProposalDetails,
  isArchiving = false,
}: ChatDetailsMobileSheetProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      handleOnly
    >
      <DrawerContent
        aria-describedby={undefined}
        data-testid="chat-details-mobile-sheet"
        className={cn("flex max-h-[90vh] flex-col gap-0 rounded-t-2xl p-0")}
      >
        <DrawerHeader className="shrink-0 space-y-0 border-b px-4 pb-3 pt-1 text-left">
          <DrawerTitle className="text-lg font-semibold">Mais informações</DrawerTitle>
        </DrawerHeader>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {detail && currentUser ? (
            <ChatDetailsPanel
              detail={detail}
              currentUser={currentUser}
              onArchive={onArchive}
              onViewProposalDetails={onViewProposalDetails}
              isArchiving={isArchiving}
            />
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
