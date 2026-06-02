import { MessageSquare } from "lucide-react";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatConversations } from "../../hooks/useChatConversations";
import { ChatListItem } from "../ChatListItem/ChatListItem";
import { ChatListItemSkeleton } from "../ChatListItem/ChatListItemSkeleton";

export interface ChatListPageProps {
  selectedChatId?: string | null;
  onSelectConversation?: (chatId: string) => void;
  className?: string;
}

export function ChatListPage({
  selectedChatId = null,
  onSelectConversation,
  className,
}: ChatListPageProps) {
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
  } = useChatConversations();

  const handleSelect = useCallback(
    (chatId: string) => {
      if (onSelectConversation) {
        onSelectConversation(chatId);
        return;
      }
      void navigate(`/dashboard/chats/${chatId}`);
    },
    [navigate, onSelectConversation],
  );

  return (
    <section
      className={cn(
        "flex h-full min-h-0 w-full flex-col",
        "md:border-r md:border-border/60",
        className,
      )}
      aria-label="Lista de conversas"
    >
      <header className="shrink-0 border-b border-border/60 px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">Conversas</h1>
        <p className="text-sm text-muted-foreground">Suas negociações com clientes e prestadores</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3">
        {isLoading ? (
          <ul className="space-y-2" aria-busy="true" aria-label="Carregando conversas">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index}>
                <ChatListItemSkeleton />
              </li>
            ))}
          </ul>
        ) : null}

        {!isLoading && isError ? (
          <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Não foi possível carregar as conversas."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {!isLoading && !isError && conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Nenhuma conversa ainda</p>
              <p className="text-sm text-muted-foreground">
                Quando você iniciar uma negociação, ela aparecerá aqui.
              </p>
            </div>
          </div>
        ) : null}

        {!isLoading && !isError && conversations.length > 0 ? (
          <ul className="space-y-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <ChatListItem
                  item={conversation}
                  isActive={selectedChatId === conversation.id}
                  onSelect={handleSelect}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {hasNextPage && !isLoading ? (
          <div className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full min-h-11"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
