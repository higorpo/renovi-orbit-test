import { cn } from "@/lib/utils";
import { usePublicProfileImageUrl } from "@/features/provider-profile/hooks/usePublicProfileImageUrl";
import { getCounterpartyInitials } from "../../utils/getCounterpartyInitials";
import {
  getChatParticipantRoleLabel,
  type ChatDetailsParticipant,
} from "../../utils/chatDetailsCopy";

export interface ChatDetailsParticipantRowProps {
  participant: ChatDetailsParticipant;
  className?: string;
}

export function ChatDetailsParticipantRow({
  participant,
  className,
}: ChatDetailsParticipantRowProps) {
  const { url, isLoading } = usePublicProfileImageUrl(participant.profileImagePath);
  const roleLabel = getChatParticipantRoleLabel(participant.role);
  const displayName = participant.isCurrentUser ? `${participant.fullName} (você)` : participant.fullName;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        aria-hidden
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          getCounterpartyInitials(participant.fullName)
        )}
        {isLoading ? (
          <span className="absolute inset-0 animate-pulse bg-muted/40" aria-hidden />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
        <p className="text-xs text-muted-foreground">{roleLabel}</p>
      </div>
    </div>
  );
}
