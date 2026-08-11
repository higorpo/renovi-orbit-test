import { MessageSquare } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatConversations } from "../../hooks/useChatConversations";
import { ServiceRequestConversationRow } from "./ServiceRequestConversationRow";
import { ServiceRequestConversationRowSkeleton } from "./ServiceRequestConversationRowSkeleton";

export interface ServiceRequestConversationListProps {
  serviceRequestId: string;
  className?: string;
}

export function ServiceRequestConversationList({
  serviceRequestId,
  className,
}: ServiceRequestConversationListProps) {
  const navigate = useNavigate();
  const {
    conversations,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useChatConversations({ serviceRequestId });

  const handleSelect = useCallback(
    (chatId: string) => {
      void navigate(`/dashboard/chats/${chatId}`);
    },
    [navigate],
  );

  return (
    <div
      className={cn("space-y-3", className)}
      aria-label="Conversas do pedido com prestadores"
    >
      {isLoading ? (
        <ul className="divide-y divide-border/80" aria-busy="true" aria-label="Carregando conversas">
          {Array.from({ length: 2 }, (_, index) => (
            <li key={index}>
              <ServiceRequestConversationRowSkeleton />
            </li>
          ))}
        </ul>
      ) : null}

      {!isLoading && isError ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Não foi possível carregar as conversas."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-medium text-ink">Nenhuma conversa ainda</p>
          <p className="text-caption text-muted-foreground">
            Quando prestadores iniciarem uma negociação neste pedido, as conversas aparecerão
            aqui.
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && conversations.length > 0 ? (
        <ul className="divide-y divide-border/80">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <ServiceRequestConversationRow item={conversation} onSelect={handleSelect} />
            </li>
          ))}
        </ul>
      ) : null}

      {hasNextPage && !isLoading ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-11 w-full rounded-lg font-semibold"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? "Carregando…" : "Carregar mais conversas"}
        </Button>
      ) : null}
    </div>
  );
}
