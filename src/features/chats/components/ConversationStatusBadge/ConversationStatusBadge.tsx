import { cn } from "@/lib/utils";
import type { CnsConversationStatus } from "../../types/chats.types";
import { getConversationStatusPresentation } from "../../utils/conversationVisualState";

export interface ConversationStatusBadgeProps {
  status: CnsConversationStatus;
  className?: string;
}

export function ConversationStatusBadge({ status, className }: ConversationStatusBadgeProps) {
  const { label, Icon, badgeClassName } = getConversationStatusPresentation(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        badgeClassName,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
