import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  getServiceDetailPath,
  SimpleServiceCard,
  SimpleServiceCardSkeleton,
  useService,
} from "@/features/view-services";
import type { MobileStackLocationState } from "@/lib/navigation/mobileStack.types";

export interface ChatDetailsServiceSectionProps {
  serviceRequestId: string;
}

export function ChatDetailsServiceSection({ serviceRequestId }: ChatDetailsServiceSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { chatId } = useParams<{ chatId?: string }>();
  const { data: service, isLoading, isError, refetch } = useService(serviceRequestId);

  const handleOpenServiceDetails = useCallback(() => {
    const stackBackPath = chatId
      ? `/dashboard/chats/${chatId}${location.search}`
      : "/dashboard/chats";

    void navigate(getServiceDetailPath(serviceRequestId), {
      state: { stackBackPath } satisfies MobileStackLocationState,
    });
  }, [chatId, location.search, navigate, serviceRequestId]);

  if (isLoading) {
    return <SimpleServiceCardSkeleton compact />;
  }

  if (isError || !service) {
    return (
      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os detalhes do serviço.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SimpleServiceCard model={service} compact />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleOpenServiceDetails}
      >
        Ver mais detalhes do serviço
      </Button>
    </div>
  );
}
