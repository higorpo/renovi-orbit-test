import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatMessageGroupPosition } from "../../utils/groupChatTimeline";

interface ChatTimelineSkeletonBubbleProps {
  isOutgoing: boolean;
  groupPosition: ChatMessageGroupPosition;
  showIncomingAvatar?: boolean;
  bubbleClassName: string;
}

function getSkeletonBubbleRadius(
  isOutgoing: boolean,
  groupPosition: ChatMessageGroupPosition,
): string {
  if (isOutgoing) {
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

function ChatTimelineSkeletonBubble({
  isOutgoing,
  groupPosition,
  showIncomingAvatar = false,
  bubbleClassName,
}: ChatTimelineSkeletonBubbleProps) {
  const rowMargin =
    groupPosition === "first" || groupPosition === "single" ? "mt-3" : "mt-0.5";

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
              <Skeleton className="h-9 w-9 rounded-full" />
            ) : null}
          </div>
        ) : null}

        <Skeleton
          className={cn(
            "max-w-[82%] shrink-0 shadow-sm",
            getSkeletonBubbleRadius(isOutgoing, groupPosition),
            bubbleClassName,
          )}
        />
      </div>
    </div>
  );
}

const SKELETON_CONVERSATION: Omit<
  ChatTimelineSkeletonBubbleProps,
  "showIncomingAvatar"
>[] = [
  { isOutgoing: false, groupPosition: "single", bubbleClassName: "h-[3.25rem] w-56" },
  { isOutgoing: true, groupPosition: "first", bubbleClassName: "h-10 w-44" },
  { isOutgoing: true, groupPosition: "last", bubbleClassName: "h-8 w-28" },
  { isOutgoing: false, groupPosition: "single", bubbleClassName: "h-11 w-52" },
  { isOutgoing: true, groupPosition: "single", bubbleClassName: "h-9 w-36" },
];

export function ChatTimelineSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 py-2 touch-pan-y",
        className,
      )}
      aria-busy="true"
      aria-label="Carregando mensagens"
    >
      <div className="min-h-0 flex-1" aria-hidden />

      <div className="my-4 flex shrink-0 justify-center">
        <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
      </div>

      {SKELETON_CONVERSATION.map((row, index) => (
        <ChatTimelineSkeletonBubble
          key={index}
          {...row}
          showIncomingAvatar={!row.isOutgoing}
        />
      ))}
    </div>
  );
}
