import { MessageSquare } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatConversations } from "../../hooks/useChatConversations";
import { ChatListItem } from "../ChatListItem/ChatListItem";
import { ChatListItemSkeleton } from "../ChatListItem/ChatListItemSkeleton";

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
    <section
      className={cn("space-y-3", className)}
      aria-label="Conversas do pedido com prestadores"
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Conversas com prestadores</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Acompanhe negociações ativas, inativas ou encerradas neste pedido.
        </p>
      </div>

      {isLoading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Carregando conversas">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index}>
              <ChatListItemSkeleton />
            </li>
          ))}
        </ul>
      ) : null}

      {!isLoading && isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-4 py-5">
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Não foi possível carregar as conversas."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma conversa ainda</p>
          <p className="text-xs text-muted-foreground">
            Quando prestadores iniciarem uma negociação neste pedido, as conversas aparecerão
            aqui.
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && conversations.length > 0 ? (
        <ul className="space-y-2">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <ChatListItem item={conversation} onSelect={handleSelect} />
            </li>
          ))}
        </ul>
      ) : null}

      {hasNextPage && !isLoading ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full min-h-10"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? "Carregando…" : "Carregar mais conversas"}
        </Button>
      ) : null}
    </section>
  );
}
