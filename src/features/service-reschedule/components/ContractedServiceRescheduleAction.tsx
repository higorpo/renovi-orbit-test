import { Button } from "@/components/ui/button";
import type { ProfileRole } from "@/features/auth";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { ServiceRescheduleSnapshot } from "../types/serviceReschedule.types";
import { RequestRescheduleDialog } from "./RequestRescheduleDialog";

export interface ContractedServiceRescheduleActionProps {
  contractedServiceId: string;
  chatId: string | null;
  viewerRole: ProfileRole;
  reschedule: ServiceRescheduleSnapshot | null | undefined;
  onSuccess?: () => void;
  className?: string;
}

export function ContractedServiceRescheduleAction({
  contractedServiceId,
  chatId,
  viewerRole,
  reschedule,
  onSuccess,
  className,
}: ContractedServiceRescheduleActionProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const canRequest = viewerRole === "client"
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
          className={cn("w-full rounded-pill sm:w-auto", className)}
          onClick={() => setOpen(true)}
        >
          <CalendarClock className="h-4 w-4" aria-hidden />
          Solicitar reagendamento
        </Button>
      ) : null}

      {hasActiveRequest ? (
        <Button
          type="button"
          variant="outline"
          className={cn("w-full rounded-pill sm:w-auto", className)}
          onClick={handleNavigateToChat}
        >
          <CalendarClock className="h-4 w-4" aria-hidden />
          Ver pedido de reagendamento
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
