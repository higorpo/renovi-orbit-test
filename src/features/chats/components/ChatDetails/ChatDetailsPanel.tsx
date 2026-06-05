import type { Profile } from "@/features/auth";
import { cn } from "@/lib/utils";
import type { ConversationDetailResponse } from "../../types/chats.types";
import {
  buildChatDetailsParticipants,
  CHAT_DETAILS_DISCLAIMER,
} from "../../utils/chatDetailsCopy";
import { ChatDetailsAcceptedProposalSection } from "./ChatDetailsAcceptedProposalSection";
import { ChatDetailsActions } from "./ChatDetailsActions";
import { ChatDetailsParticipantRow } from "./ChatDetailsParticipantRow";
import { ChatDetailsServiceSection } from "./ChatDetailsServiceSection";

export interface ChatDetailsPanelProps {
  detail: ConversationDetailResponse;
  currentUser: Profile;
  onArchive: () => void;
  onViewProposalDetails?: (proposalId: string) => void;
  isArchiving?: boolean;
  className?: string;
}

export function ChatDetailsPanel({
  detail,
  currentUser,
  onArchive,
  onViewProposalDetails,
  isArchiving = false,
  className,
}: ChatDetailsPanelProps) {
  const participants = buildChatDetailsParticipants(detail, currentUser);
  const canArchive = detail.conversation.status !== "CLOSED";
  const acceptedProposal = detail.accepted_proposal;

  return (
    <div className={cn("space-y-6", className)}>
      {acceptedProposal && onViewProposalDetails ? (
        <ChatDetailsAcceptedProposalSection
          acceptedProposal={acceptedProposal}
          viewerRole={currentUser.role}
          onViewDetails={onViewProposalDetails}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Detalhes do serviço</h2>
        <ChatDetailsServiceSection serviceRequestId={detail.service_request.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Participantes</h2>
        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
          {participants.map((participant) => (
            <ChatDetailsParticipantRow key={participant.id} participant={participant} />
          ))}
        </div>
      </section>

      <ChatDetailsActions
        canArchive={canArchive}
        isArchiving={isArchiving}
        onArchive={onArchive}
      />

      <section className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <h2 className="text-sm font-semibold text-foreground">{CHAT_DETAILS_DISCLAIMER.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {CHAT_DETAILS_DISCLAIMER.body}
        </p>
      </section>
    </div>
  );
}
