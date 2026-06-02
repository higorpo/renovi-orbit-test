import { cn } from "@/lib/utils";
import type { ChatMessageGroupPosition } from "./groupChatTimeline";

export function getChatMessageBubbleClassName(options: {
  isOutgoing: boolean;
  groupPosition: ChatMessageGroupPosition;
  isPending?: boolean;
}): string {
  const radius = options.isOutgoing
    ? getOutgoingBubbleRadius(options.groupPosition)
    : getIncomingBubbleRadius(options.groupPosition);

  return cn(
    "max-w-[82%] shadow-sm",
    radius,
    options.isOutgoing
      ? "bg-primary text-primary-foreground"
      : "bg-muted text-foreground",
    options.isPending && "opacity-70",
  );
}

function getOutgoingBubbleRadius(groupPosition: ChatMessageGroupPosition): string {
  switch (groupPosition) {
    case "single":
      return "rounded-2xl rounded-br-md";
    case "first":
      return "rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-md";
    case "middle":
      return "rounded-tl-2xl rounded-bl-2xl rounded-tr-md rounded-br-md";
    case "last":
      return "rounded-tl-2xl rounded-tr-md rounded-bl-2xl rounded-br-md";
  }
}

function getIncomingBubbleRadius(groupPosition: ChatMessageGroupPosition): string {
  switch (groupPosition) {
    case "single":
      return "rounded-2xl rounded-bl-md";
    case "first":
      return "rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-md";
    case "middle":
      return "rounded-tr-2xl rounded-br-2xl rounded-tl-md rounded-bl-md";
    case "last":
      return "rounded-tl-md rounded-tr-2xl rounded-bl-md rounded-br-2xl";
  }
}
