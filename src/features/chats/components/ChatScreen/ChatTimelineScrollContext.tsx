import { createContext, useContext } from "react";

export interface ChatTimelineScrollContextValue {
  preserveScrollOnLayoutShift: () => void;
}

export const ChatTimelineScrollContext = createContext<ChatTimelineScrollContextValue | null>(
  null,
);

export function useChatTimelineScrollContext(): ChatTimelineScrollContextValue | null {
  return useContext(ChatTimelineScrollContext);
}
