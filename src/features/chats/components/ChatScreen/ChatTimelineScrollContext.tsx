import { createContext, useContext } from "react";

export interface ChatTimelineScrollContextValue {
  preserveScrollOnLayoutShift: () => void;
  /** Call when the composer input is focused, before the keyboard opens. */
  onComposerFocus: () => void;
}

export const ChatTimelineScrollContext = createContext<ChatTimelineScrollContextValue | null>(
  null,
);

export function useChatTimelineScrollContext(): ChatTimelineScrollContextValue | null {
  return useContext(ChatTimelineScrollContext);
}
