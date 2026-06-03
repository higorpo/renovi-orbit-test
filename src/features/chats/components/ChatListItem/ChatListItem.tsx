import { getServiceCardStyle } from "@/features/request-quote";
import { cn } from "@/lib/utils";
import type { ConversationListItem } from "../../types/chats.types";
import { ConversationStatusBadge } from "../ConversationStatusBadge/ConversationStatusBadge";
import { formatChatListTimestamp } from "../../utils/formatChatListTimestamp";
import { getConversationStatusPresentation } from "../../utils/conversationVisualState";
import { getCounterpartyInitials } from "../../utils/getCounterpartyInitials";

export interface ChatListItemProps {
  item: ConversationListItem;
  isActive?: boolean;
  onSelect: (chatId: string) => void;
  className?: string;
}

export function ChatListItem({ item, isActive = false, onSelect, className }: ChatListItemProps) {
  const serviceStyle = getServiceCardStyle({
    icon_key: item.service.icon_key,
    color_key: item.service.color_key,
  });
  const counterpartyName = item.counterparty.full_name?.trim() || "Participante";
  const preview = item.last_message?.preview_text?.trim() || "Sem mensagens ainda";
  const timestampSource = item.last_message?.created_at ?? item.last_interaction_at;
  const statusPresentation = getConversationStatusPresentation(item.status);

  const handleActivate = () => onSelect(item.id);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      }}
      className={cn(
        "flex min-h-[84px] w-full cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition-colors",
        "hover:bg-muted/50 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive ? "border-border bg-muted/80" : "border-transparent bg-card",
        item.is_unread && !isActive && "bg-muted/60",
        statusPresentation.listItemClassName,
        className,
      )}
      aria-current={isActive ? "true" : undefined}
      aria-label={`Conversa com ${counterpartyName}, ${item.service_request_title}`}
    >
      <div className="relative h-12 w-12 shrink-0">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
            serviceStyle.color,
          )}
          aria-hidden
        >
          <serviceStyle.Icon className="h-5 w-5" />
        </div>
        <div
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-semibold text-primary-foreground shadow-sm"
          aria-hidden
        >
          {getCounterpartyInitials(item.counterparty.full_name)}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{counterpartyName}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {item.is_unread ? (
              <span
                className="h-2 w-2 rounded-full bg-primary"
                aria-label="Mensagens não lidas"
              />
            ) : null}
            <time
              className="text-xs text-muted-foreground"
              dateTime={timestampSource}
            >
              {formatChatListTimestamp(timestampSource)}
            </time>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
            {item.service_request_title}
          </p>
          {statusPresentation.showInList ? (
            <ConversationStatusBadge status={item.status} className="shrink-0" />
          ) : null}
        </div>

        <p className="truncate text-sm text-muted-foreground">{preview}</p>
      </div>
    </article>
  );
}
