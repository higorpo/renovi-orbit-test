import { MessageSquare } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ServiceRequestContractedChatButtonProps {
  chatId: string | null;
  providerDisplayName?: string | null;
  className?: string;
}

export function ServiceRequestContractedChatButton({
  chatId,
  providerDisplayName,
  className,
}: ServiceRequestContractedChatButtonProps) {
  const navigate = useNavigate();

  const label = providerDisplayName?.trim()
    ? `Ver conversa com ${providerDisplayName.trim()}`
    : "Ver conversa com prestador";

  const handleOpenChat = useCallback(() => {
    if (!chatId) return;
    void navigate(`/dashboard/chats/${chatId}`);
  }, [chatId, navigate]);

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("gap-1.5", className)}
      disabled={!chatId}
      onClick={handleOpenChat}
    >
      <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Button>
  );
}
