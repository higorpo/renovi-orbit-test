import { cn } from "@/lib/utils";
import { getChatMessageText } from "../../utils/getChatMessageText";
import type { ChatMessageListItem } from "../../types/chats.types";

export function WorkflowActionMessage({
  message,
  className,
}: {
  message: ChatMessageListItem;
  className?: string;
}) {
  const actionKey =
    typeof message.payload.action_key === "string" ? message.payload.action_key : null;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[88%] rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground shadow-sm",
        className,
      )}
      role="status"
    >
      <p className="text-foreground">{getChatMessageText(message)}</p>
      {actionKey ? <p className="mt-1 text-xs opacity-70">{actionKey}</p> : null}
    </div>
  );
}
