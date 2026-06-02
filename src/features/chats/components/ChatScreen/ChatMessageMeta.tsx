import { cn } from "@/lib/utils";
import { formatChatMessageGroupTimestamp } from "../../utils/formatChatMessageGroupTimestamp";

export interface ChatMessageMetaProps {
  createdAt: string;
  isOutgoing: boolean;
  showTimestamp: boolean;
  showReadReceipt: boolean;
  className?: string;
}

export function ChatMessageMeta({
  createdAt,
  isOutgoing,
  showTimestamp,
  showReadReceipt,
  className,
}: ChatMessageMetaProps) {
  if (!showTimestamp && !showReadReceipt) return null;

  const parts: string[] = [];
  if (showTimestamp) {
    parts.push(formatChatMessageGroupTimestamp(createdAt));
  }
  if (showReadReceipt) {
    parts.push("Visualizado");
  }

  return (
    <div
      className={cn(
        "mt-1 flex w-full gap-2",
        isOutgoing ? "justify-end" : "justify-start",
        className,
      )}
    >
      {!isOutgoing ? <div className="w-9 shrink-0" aria-hidden /> : null}
      <p
        className={cn(
          "text-xs text-muted-foreground",
          isOutgoing ? "pr-1 text-right" : "text-left",
        )}
        aria-label={
          showReadReceipt && showTimestamp
            ? `${parts[0]}, visualizado`
            : showReadReceipt
              ? "Visualizado"
              : parts[0]
        }
      >
        {parts.join(" · ")}
      </p>
    </div>
  );
}
