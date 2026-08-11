import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePublicProfileImageUrl } from "@/features/provider-profile";
import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/utils/initialsFromName";
import type { ConversationListItem } from "../../types/chats.types";
import { formatChatListTimestamp } from "../../utils/formatChatListTimestamp";

export interface ServiceRequestConversationRowProps {
  item: ConversationListItem;
  onSelect: (chatId: string) => void;
  className?: string;
}

export function ServiceRequestConversationRow({
  item,
  onSelect,
  className,
}: ServiceRequestConversationRowProps) {
  const counterpartyName = item.counterparty.full_name?.trim() || "Participante";
  const preview = item.last_message?.preview_text?.trim() || "Sem mensagens ainda";
  const timestampSource = item.last_message?.created_at ?? item.last_interaction_at;
  const { url } = usePublicProfileImageUrl(item.counterparty.profile_image_path);

  const handleActivate = () => onSelect(item.id);

  return (
    <button
      type="button"
      onClick={handleActivate}
      className={cn(
        "flex w-full items-center gap-3 px-0 py-3 text-left transition-colors",
        "hover:bg-muted/40 active:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        item.is_unread && "bg-muted/30",
        className,
      )}
      aria-label={`Conversa com ${counterpartyName}`}
    >
      <Avatar className="h-11 w-11 shrink-0">
        {url ? <AvatarImage src={url} alt="" /> : null}
        <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
          {initialsFromName(item.counterparty.full_name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-ink">{counterpartyName}</p>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {item.is_unread ? (
              <span
                className="h-2 w-2 rounded-full bg-primary"
                aria-label="Mensagens não lidas"
              />
            ) : null}
            <time className="text-caption text-muted-foreground" dateTime={timestampSource}>
              {formatChatListTimestamp(timestampSource)}
            </time>
          </div>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{preview}</p>
      </div>
    </button>
  );
}
