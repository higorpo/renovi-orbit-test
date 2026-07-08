import { memo } from "react";
import type { ProfileRole } from "@/features/auth";
import { cn } from "@/lib/utils";
import { areChatMessageListItemsEqual } from "../../utils/chatMessageEquality";
import { DynamicMessageRenderer } from "../DynamicMessageRenderer/DynamicMessageRenderer";
import type { ProposalCardAction } from "../DynamicMessageRenderer/DynamicProposalCard";
import type { RescheduleCardAction } from "../DynamicMessageRenderer/DynamicRescheduleProposalCard";
import { isServiceRescheduleProposedWorkflowMessage } from "@/features/service-reschedule";
import type { ChatMessageListItem } from "../../types/chats.types";
import type { ChatMessageGroupPosition } from "../../utils/groupChatTimeline";
import { getChatMessageText } from "../../utils/getChatMessageText";
import { getChatMessageBubbleClassName } from "../../utils/chatMessageBubbleStyles";
import { initialsFromName } from "@/lib/utils/initialsFromName";
import { ChatMessageMeta } from "./ChatMessageMeta";

export interface ChatMessageRowProps {
  chatId: string;
  message: ChatMessageListItem;
  groupPosition: ChatMessageGroupPosition;
  showIncomingAvatar: boolean;
  showGroupTimestamp: boolean;
  showReadReceipt: boolean;
  isOutgoing: boolean;
  counterpartyName: string;
  viewerRole: ProfileRole;
  onProposalAction?: (action: ProposalCardAction, proposalId: string) => void;
  onRescheduleAction?: (action: RescheduleCardAction, requestId: string) => void;
}

function chatMessageRowPropsAreEqual(
  prev: ChatMessageRowProps,
  next: ChatMessageRowProps,
): boolean {
  return (
    prev.chatId === next.chatId &&
    prev.isOutgoing === next.isOutgoing &&
    prev.groupPosition === next.groupPosition &&
    prev.showIncomingAvatar === next.showIncomingAvatar &&
    prev.showGroupTimestamp === next.showGroupTimestamp &&
    prev.showReadReceipt === next.showReadReceipt &&
    prev.counterpartyName === next.counterpartyName &&
    prev.viewerRole === next.viewerRole &&
    prev.onProposalAction === next.onProposalAction &&
    prev.onRescheduleAction === next.onRescheduleAction &&
    areChatMessageListItemsEqual(prev.message, next.message)
  );
}

export const ChatMessageRow = memo(function ChatMessageRow({
  chatId,
  message,
  groupPosition,
  showIncomingAvatar,
  showGroupTimestamp,
  showReadReceipt,
  isOutgoing,
  counterpartyName,
  viewerRole,
  onProposalAction,
  onRescheduleAction,
}: ChatMessageRowProps) {
  const text = getChatMessageText(message);
  const isPending = message.delivery_status === "PENDING";
  const rowMargin =
    groupPosition === "first" || groupPosition === "single" ? "mt-3" : "mt-0.5";
  const showMeta = showGroupTimestamp || showReadReceipt;
  const usesBubbleRowLayout =
    message.message_type === "TEXT" ||
    message.message_type === "IMAGE" ||
    message.message_type === "AUDIO";
  const usesInteractiveCardRowLayout =
    message.message_type === "PROPOSAL" ||
    isServiceRescheduleProposedWorkflowMessage(message);

  if (!usesBubbleRowLayout) {
    if (usesInteractiveCardRowLayout) {
      return (
        <div className={cn("w-full", rowMargin)}>
          <div
            className={cn(
              "flex w-full gap-2",
              isOutgoing ? "justify-end" : "justify-start",
            )}
          >
            {!isOutgoing ? (
              <div className="w-9 shrink-0">
                {showIncomingAvatar ? (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
                    aria-hidden
                  >
                    {initialsFromName(counterpartyName)}
                  </div>
                ) : null}
              </div>
            ) : null}

            <DynamicMessageRenderer
              chatId={chatId}
              message={message}
              viewerRole={viewerRole}
              isOutgoing={isOutgoing}
              onProposalAction={onProposalAction}
              onRescheduleAction={onRescheduleAction}
            />
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          "flex w-full",
          isOutgoing ? "justify-end" : "justify-start",
          rowMargin,
        )}
      >
        <DynamicMessageRenderer
          chatId={chatId}
          message={message}
          viewerRole={viewerRole}
          isOutgoing={isOutgoing}
          onProposalAction={onProposalAction}
          onRescheduleAction={onRescheduleAction}
        />
      </div>
    );
  }

  return (
    <div className={cn("w-full", rowMargin)}>
      <div
        className={cn(
          "flex w-full gap-2",
          isOutgoing ? "justify-end" : "justify-start",
        )}
      >
        {!isOutgoing ? (
          <div className="w-9 shrink-0">
            {showIncomingAvatar ? (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
                aria-hidden
              >
                {initialsFromName(counterpartyName)}
              </div>
            ) : null}
          </div>
        ) : null}

        {message.message_type === "TEXT" ? (
          <div
            className={cn(
              getChatMessageBubbleClassName({ isOutgoing, isPending, groupPosition }),
              "px-4 py-2.5 text-[15px] leading-relaxed",
            )}
          >
            <p className="whitespace-pre-wrap break-words">{text}</p>
          </div>
        ) : (
          <DynamicMessageRenderer
            chatId={chatId}
            message={message}
            viewerRole={viewerRole}
            isOutgoing={isOutgoing}
            groupPosition={groupPosition}
            onProposalAction={onProposalAction}
            onRescheduleAction={onRescheduleAction}
          />
        )}
      </div>

      {showMeta ? (
        <ChatMessageMeta
          createdAt={message.created_at}
          isOutgoing={isOutgoing}
          showTimestamp={showGroupTimestamp}
          showReadReceipt={showReadReceipt}
        />
      ) : null}
    </div>
  );
}, chatMessageRowPropsAreEqual);
