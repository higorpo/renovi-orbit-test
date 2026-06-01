import { MessageSquare } from "lucide-react";
import { Outlet, useNavigate, useParams } from "react-router";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { cn } from "@/lib/utils";
import { ChatMobileViewportProvider } from "../ChatScreen/ChatMobileViewportContext";
import { ChatListPage } from "../ChatListPage/ChatListPage";

export function ChatsLayout() {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const showListOnMobile = !chatId;
  const showConversationOnMobile = Boolean(chatId);
  const isMobileFullscreenConversation = showConversationOnMobile;
  const { contentRef, scheduleSync } = useMobileDialogViewport(isMobileFullscreenConversation);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          className={cn(
            "min-h-0 shrink-0",
            showListOnMobile ? "flex flex-1 flex-col" : "hidden",
            "md:flex md:flex-col",
          )}
        >
          <ChatListPage
            selectedChatId={chatId ?? null}
            onSelectConversation={(id) => void navigate(`/dashboard/chats/${id}`)}
            className="h-full min-h-0 md:max-w-[420px] md:min-w-[320px]"
          />
        </div>

        <div
          ref={contentRef}
          className={cn(
            "min-h-0 flex-1 flex-col",
            showConversationOnMobile ? "flex" : "hidden",
            "md:flex",
            isMobileFullscreenConversation &&
              cn(
                "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:flex max-md:flex-col max-md:bg-background",
                isOnline ? "max-md:top-0 max-md:h-dvh" : "max-md:top-11 max-md:h-[calc(100dvh-2.75rem)]",
              ),
          )}
          data-testid={isMobileFullscreenConversation ? "chat-conversation-fullscreen" : undefined}
        >
          {chatId ? (
            <ChatMobileViewportProvider scheduleSync={scheduleSync}>
              <div className="flex min-h-0 flex-1 flex-col">
                <Outlet />
              </div>
            </ChatMobileViewportProvider>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 px-6 text-center md:flex">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-6 w-6 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm font-medium text-foreground">Selecione uma conversa</p>
              <p className="text-sm text-muted-foreground">
                Escolha um contato na lista para ver as mensagens.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
