import { createContext, useContext, type ReactNode } from "react";

const ChatMobileViewportContext = createContext<(() => void) | null>(null);

export function ChatMobileViewportProvider({
  scheduleSync,
  children,
}: {
  scheduleSync: () => void;
  children: ReactNode;
}) {
  return (
    <ChatMobileViewportContext.Provider value={scheduleSync}>
      {children}
    </ChatMobileViewportContext.Provider>
  );
}

export function useChatMobileViewportSchedule(): () => void {
  return useContext(ChatMobileViewportContext) ?? (() => undefined);
}
