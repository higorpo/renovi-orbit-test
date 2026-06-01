import { MessageSquare } from "lucide-react";
import { Outlet, useNavigate, useParams } from "react-router";
import { cn } from "@/lib/utils";
import { ChatListPage } from "../ChatListPage/ChatListPage";

export function ChatsLayout() {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();

  const showListOnMobile = !chatId;
  const showConversationOnMobile = Boolean(chatId);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-background">
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
          className={cn(
            "min-h-0 flex-1 flex-col",
            showConversationOnMobile ? "flex" : "hidden",
            "md:flex",
          )}
        >
          {chatId ? (
            <Outlet />
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
