import { MessageSquare } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { cn } from "@/lib/utils";
import { useInboxRealtime } from "../../hooks/useInboxRealtime";
import { ChatMobileViewportProvider } from "../ChatScreen/ChatMobileViewportContext";
import { ChatListPage } from "../ChatListPage/ChatListPage";

const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;
const SLIDE_DURATION = 0.28;

export function ChatsLayout() {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const isDesktop = useBreakpointMd();
  const prefersReducedMotion = useReducedMotion();

  const showListOnMobile = !chatId;
  const showConversationOnMobile = Boolean(chatId);
  const isMobileFullscreenConversation = showConversationOnMobile && !isDesktop;
  const { contentRef, scheduleSync } = useMobileDialogViewport(isMobileFullscreenConversation);

  useInboxRealtime();

  const conversationPanelClassName = cn(
    "min-h-0 min-w-0 flex-1 flex-col bg-background",
    isMobileFullscreenConversation &&
      cn(
        "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:flex max-md:flex-col",
        isOnline ? "max-md:top-0 max-md:h-dvh" : "max-md:top-11 max-md:h-[calc(100dvh-2.75rem)]",
      ),
  );

  const conversationContent =
    chatId ? (
      <ChatMobileViewportProvider scheduleSync={scheduleSync}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
    );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        <div
          data-testid="chat-list-panel"
          className={cn(
            "min-h-0 shrink-0",
            showListOnMobile ? "flex max-md:flex-1 flex-col" : "hidden",
            "md:flex md:w-[360px] md:flex-none md:flex-col",
          )}
        >
          <ChatListPage
            selectedChatId={chatId ?? null}
            onSelectConversation={(id) =>
              void navigate(`/dashboard/chats/${id}${location.search}`)
            }
            className="h-full min-h-0"
          />
        </div>

        {isDesktop ? (
          <div
            ref={contentRef}
            className={cn("flex min-h-0 min-w-0 flex-1 flex-col", showConversationOnMobile ? "flex" : "hidden", "md:flex")}
          >
            {conversationContent}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {showConversationOnMobile ? (
              prefersReducedMotion ? (
                <div
                  ref={contentRef}
                  className={conversationPanelClassName}
                  data-testid="chat-conversation-fullscreen"
                >
                  {conversationContent}
                </div>
              ) : (
                <motion.div
                  ref={contentRef}
                  key="chat-conversation"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ duration: SLIDE_DURATION, ease: SLIDE_EASE }}
                  className={conversationPanelClassName}
                  data-testid="chat-conversation-fullscreen"
                >
                  {conversationContent}
                </motion.div>
              )
            ) : null}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
