import { Link, Outlet, useMatch } from "react-router";
import { useAuth } from "@/features/auth";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getDashboardMenu } from "./dashboardMenu";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { cn } from "@/lib/utils";

/** Mobile conversation view uses the chat chrome instead of dashboard nav. */
const MOBILE_CHAT_CONVERSATION_MATCH = { path: "/dashboard/chats/:chatId", end: true } as const;

export function DashboardLayout() {
  const { profile } = useAuth();
  const isDesktop = useBreakpointMd();
  const isOnline = useOnlineStatus();
  const mobileChatConversationMatch = useMatch(MOBILE_CHAT_CONVERSATION_MATCH);
  const isMobileChatConversation = !isDesktop && mobileChatConversationMatch != null;
  const role = profile?.role ?? "client";
  const menu = getDashboardMenu(role);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-background">
      {/* Desktop: top bar with logo + nav */}
      {isDesktop && (
        <header
          className={cn(
            "sticky z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
            isOnline ? "top-0" : "top-11"
          )}
        >
          <div className="container flex h-14 items-center justify-between px-4">
            <Link to="/dashboard" className="flex items-center shrink-0">
              <img
                src="/logo-renovi.webp"
                alt="Renovi"
                className="h-7 md:h-8 w-auto"
              />
            </Link>
            <DesktopNav items={menu.allItems} />
          </div>
        </header>
      )}

      {/* Mobile: top bar with hamburger + bottom nav (hidden during fullscreen chat) */}
      {!isDesktop && !isMobileChatConversation ? (
        <MobileNav menu={menu} isOffline={!isOnline} />
      ) : null}

      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          isMobileChatConversation ? "overflow-hidden" : "overflow-y-auto",
          !isDesktop && !isMobileChatConversation && "pb-20",
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
