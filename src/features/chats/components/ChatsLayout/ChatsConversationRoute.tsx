import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AcceptProposalDialog } from "@/features/negotiation-proposals";
import type { ProposalSuggestedSlotRpc } from "@/features/negotiation-proposals";
import { useConversationDetail } from "../../hooks/useConversationDetail";
import type { ProposalCardAction } from "../DynamicMessageRenderer/DynamicProposalCard";
import { ChatScreen } from "../ChatScreen/ChatScreen";

const FALLBACK_SUGGESTED_SLOTS: ProposalSuggestedSlotRpc[] = [
  { start_date: "2026-06-15", shift: "morning" },
];

export function ChatsConversationRoute() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { detail } = useConversationDetail(chatId ?? null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptProposalId, setAcceptProposalId] = useState<string | null>(null);

  const handleProposalAction = useCallback((action: ProposalCardAction, proposalId: string) => {
    if (action === "accept") {
      setAcceptProposalId(proposalId);
      setAcceptOpen(true);
    }
  }, []);

  if (!chatId) return null;

  return (
    <>
      <ChatScreen
        chatId={chatId}
        onBack={() => void navigate("/dashboard/chats")}
        onProposalAction={handleProposalAction}
        className="h-full min-h-0"
      />
      <AcceptProposalDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        chatId={chatId}
        serviceRequestId={detail?.service_request.id ?? null}
        proposalId={acceptProposalId}
        suggestedSlots={FALLBACK_SUGGESTED_SLOTS}
      />
    </>
  );
}
