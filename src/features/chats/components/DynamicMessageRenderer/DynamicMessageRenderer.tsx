import type { ProfileRole } from "@/features/auth";
import { metrics } from "@/lib/sentry";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import type { ChatMessageListItem, CnsMessageType } from "../../types/chats.types";
import type { ChatMessageGroupPosition } from "../../utils/groupChatTimeline";
import { getChatMessageText } from "../../utils/getChatMessageText";
import {
  DynamicProposalCard,
  type DynamicProposalCardProps,
  type ProposalCardAction,
} from "./DynamicProposalCard";
import {
  DynamicRescheduleProposalCard,
  type DynamicRescheduleProposalCardProps,
  type RescheduleCardAction,
} from "./DynamicRescheduleProposalCard";
import { ChatImageMessage } from "./ChatImageMessage";
import { ChatAudioMessage } from "./ChatAudioMessage";
import { UnknownDynamicMessage } from "./UnknownDynamicMessage";
import { WorkflowActionMessage } from "./WorkflowActionMessage";

export interface DynamicMessageRendererProps {
  chatId: string;
  message: ChatMessageListItem;
  viewerRole: ProfileRole;
  isOutgoing: boolean;
  groupPosition?: ChatMessageGroupPosition;
  onProposalAction?: (action: ProposalCardAction, proposalId: string) => void;
  onRescheduleAction?: (action: RescheduleCardAction, requestId: string) => void;
  className?: string;
}

function isKnownMessageType(type: CnsMessageType): boolean {
  return (
    type === "PROPOSAL" ||
    type === "WORKFLOW_ACTION" ||
    type === "SYSTEM" ||
    type === "IMAGE" ||
    type === "AUDIO"
  );
}

export function DynamicMessageRenderer({
  chatId,
  message,
  viewerRole,
  isOutgoing,
  groupPosition = "single",
  onProposalAction,
  onRescheduleAction,
  className,
}: DynamicMessageRendererProps) {
  useEffect(() => {
    metrics.count("chats.dynamic_message_render", 1, {
      message_type: message.message_type,
    });
  }, [message.message_type]);

  if (message.message_type === "PROPOSAL") {
    const proposalProps: DynamicProposalCardProps = {
      chatId,
      message,
      viewerRole,
      isOutgoing,
      onProposalAction,
      className,
    };
    return <DynamicProposalCard {...proposalProps} />;
  }

  if (message.message_type === "WORKFLOW_ACTION") {
    const actionKey = message.payload?.action_key;
    if (actionKey === "service_reschedule_proposed") {
      const rescheduleProps: DynamicRescheduleProposalCardProps = {
        chatId,
        message,
        viewerRole,
        isOutgoing,
        onRescheduleAction,
        className,
      };
      return <DynamicRescheduleProposalCard {...rescheduleProps} />;
    }

    return <WorkflowActionMessage message={message} className={className} />;
  }

  if (message.message_type === "SYSTEM") {
    return (
      <div
        className={cn(
          "mx-auto w-full max-w-[88%] rounded-full bg-muted/50 px-4 py-2 text-center text-xs text-muted-foreground",
          className,
        )}
        role="status"
      >
        {getChatMessageText(message)}
      </div>
    );
  }

  if (message.message_type === "IMAGE") {
    return (
      <ChatImageMessage
        message={message}
        isOutgoing={isOutgoing}
        groupPosition={groupPosition}
        className={className}
      />
    );
  }

  if (message.message_type === "AUDIO") {
    return (
      <ChatAudioMessage
        message={message}
        isOutgoing={isOutgoing}
        groupPosition={groupPosition}
        className={className}
      />
    );
  }

  if (!isKnownMessageType(message.message_type)) {
    return (
      <UnknownDynamicMessage
        messageType={message.message_type}
        previewText={getChatMessageText(message)}
        className={className}
      />
    );
  }

  return (
    <UnknownDynamicMessage
      messageType={message.message_type}
      previewText={getChatMessageText(message)}
      className={className}
    />
  );
}
