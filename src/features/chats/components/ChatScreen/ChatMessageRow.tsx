import type { ProfileRole } from "@/features/auth";
import { cn } from "@/lib/utils";
import { DynamicMessageRenderer } from "../DynamicMessageRenderer/DynamicMessageRenderer";
import type { ProposalCardAction } from "../DynamicMessageRenderer/DynamicProposalCard";
import type { ChatMessageListItem } from "../../types/chats.types";
import type { ChatMessageGroupPosition } from "../../utils/groupChatTimeline";
import { getChatMessageText } from "../../utils/getChatMessageText";
import { getCounterpartyInitials } from "../../utils/getCounterpartyInitials";

export interface ChatMessageRowProps {
  chatId: string;
  message: ChatMessageListItem;
  groupPosition: ChatMessageGroupPosition;
  showIncomingAvatar: boolean;
  isOutgoing: boolean;
  counterpartyName: string;
  viewerRole: ProfileRole;
  onProposalAction?: (action: ProposalCardAction, proposalId: string) => void;
}

export function ChatMessageRow({
  chatId,
  message,
  groupPosition,
  showIncomingAvatar,
  isOutgoing,
  counterpartyName,
  viewerRole,
  onProposalAction,
}: ChatMessageRowProps) {
  const text = getChatMessageText(message);
  const isPending = message.delivery_status === "PENDING";

  if (message.message_type !== "TEXT") {
    return (
      <div
        className={cn(
          "flex w-full",
          isOutgoing ? "justify-end" : "justify-start",
          groupPosition === "first" || groupPosition === "single" ? "mt-3" : "mt-1",
        )}
      >
        <DynamicMessageRenderer
          chatId={chatId}
          message={message}
          viewerRole={viewerRole}
          isOutgoing={isOutgoing}
          onProposalAction={onProposalAction}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isOutgoing ? "justify-end" : "justify-start",
        groupPosition === "first" || groupPosition === "single" ? "mt-3" : "mt-1",
      )}
    >
      {!isOutgoing ? (
        <div className="w-9 shrink-0">
          {showIncomingAvatar ? (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
              aria-hidden
            >
              {getCounterpartyInitials(counterpartyName)}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm",
          isOutgoing
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-muted text-foreground",
          isPending && "opacity-70",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </div>
    </div>
  );
}
