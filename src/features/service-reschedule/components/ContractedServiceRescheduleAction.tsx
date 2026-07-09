import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import type { ProfileRole } from "@/features/auth";
import type { ServiceRescheduleSnapshot } from "../types/serviceReschedule.types";
import { RequestRescheduleDialog } from "./RequestRescheduleDialog";

export interface ContractedServiceRescheduleActionProps {
  contractedServiceId: string;
  chatId: string | null;
  viewerRole: ProfileRole;
  reschedule: ServiceRescheduleSnapshot | null | undefined;
  onSuccess?: () => void;
}

export function ContractedServiceRescheduleAction({
  contractedServiceId,
  chatId,
  viewerRole,
  reschedule,
  onSuccess,
}: ContractedServiceRescheduleActionProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const canRequest =
    viewerRole === "client"
      ? Boolean(reschedule?.canClientRequestReschedule)
      : Boolean(reschedule?.canProviderRequestReschedule);

  const hasActiveRequest = Boolean(reschedule?.activeRequest);
  const targetChatId = reschedule?.activeRequest?.chat_id ?? chatId;

  if (!canRequest && !hasActiveRequest) {
    return null;
  }

  const handleNavigateToChat = () => {
    if (!targetChatId) return;
    void navigate(`/dashboard/chats/${targetChatId}`);
  };

  return (
    <>
      {canRequest ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-pill sm:w-auto"
          onClick={() => setOpen(true)}
        >
          <CalendarClock className="mr-2 h-4 w-4" aria-hidden />
          Solicitar reagendamento
        </Button>
      ) : null}

      {hasActiveRequest ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-pill sm:w-auto"
          onClick={handleNavigateToChat}
        >
          Ver pedido de reagendamento no chat
        </Button>
      ) : null}

      <RequestRescheduleDialog
        open={open}
        onOpenChange={setOpen}
        contractedServiceId={contractedServiceId}
        onSuccess={(nextChatId) => {
          onSuccess?.();
          if (nextChatId) {
            void navigate(`/dashboard/chats/${nextChatId}`);
          }
        }}
      />
    </>
  );
}
