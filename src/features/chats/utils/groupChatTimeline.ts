import type { ChatMessageListItem } from "../types/chats.types";

const GROUP_GAP_MS = 5 * 60_000;

export type ChatMessageGroupPosition = "single" | "first" | "middle" | "last";

export interface ChatTimelineDateSeparator {
  type: "date";
  key: string;
  label: string;
}

export interface ChatTimelineMessageItem {
  type: "message";
  key: string;
  message: ChatMessageListItem;
  groupPosition: ChatMessageGroupPosition;
  showIncomingAvatar: boolean;
  isOutgoing: boolean;
}

export interface ChatTimelineDiscoveryWelcome {
  type: "discovery_welcome";
  key: typeof CHAT_DISCOVERY_WELCOME_KEY;
}

export const CHAT_DISCOVERY_WELCOME_KEY = "discovery-welcome" as const;

export type ChatTimelineItem =
  | ChatTimelineDateSeparator
  | ChatTimelineMessageItem
  | ChatTimelineDiscoveryWelcome;

function startOfLocalDay(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function formatDateSeparatorLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";

  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

function isSameGroup(
  previous: ChatMessageListItem,
  current: ChatMessageListItem,
): boolean {
  if (previous.sender_user_id !== current.sender_user_id) return false;

  const gap = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
  return gap >= 0 && gap <= GROUP_GAP_MS;
}

function resolveGroupPosition(index: number, total: number): ChatMessageGroupPosition {
  if (total === 1) return "single";
  if (index === 0) return "first";
  if (index === total - 1) return "last";
  return "middle";
}

export function buildChatTimelineItems(
  messages: ChatMessageListItem[],
  currentUserId: string | null,
): ChatTimelineItem[] {
  if (messages.length === 0) return [];

  const items: ChatTimelineItem[] = [];
  let lastDayKey: string | null = null;
  let groupStart = 0;

  const flushGroup = (endIndex: number) => {
    const groupMessages = messages.slice(groupStart, endIndex + 1);
    const firstMessage = groupMessages[0]!;
    const isOutgoing = Boolean(currentUserId && firstMessage.sender_user_id === currentUserId);

    groupMessages.forEach((message, index) => {
      items.push({
        type: "message",
        key: message.id,
        message,
        groupPosition: resolveGroupPosition(index, groupMessages.length),
        showIncomingAvatar: !isOutgoing && index === 0,
        isOutgoing,
      });
    });
  };

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;
    const dayKey = startOfLocalDay(message.created_at);

    if (dayKey !== lastDayKey) {
      if (index > 0) {
        flushGroup(index - 1);
        groupStart = index;
      }

      items.push({
        type: "date",
        key: `date:${dayKey}`,
        label: formatDateSeparatorLabel(message.created_at),
      });
      lastDayKey = dayKey;
    }

    const previous = messages[index - 1];
    if (previous && !isSameGroup(previous, message)) {
      flushGroup(index - 1);
      groupStart = index;
    }
  }

  flushGroup(messages.length - 1);
  return items;
}

function buildDateSeparatorItem(iso: string): ChatTimelineDateSeparator {
  const dayKey = startOfLocalDay(iso);
  return {
    type: "date",
    key: `date:${dayKey}`,
    label: formatDateSeparatorLabel(iso),
  };
}

/**
 * Inserts the discovery welcome card at the oldest loaded history edge, with a date pill above it.
 */
export function prependDiscoveryWelcomeToTimeline(
  items: ChatTimelineItem[],
  anchorIso: string,
): ChatTimelineItem[] {
  const welcomeItem: ChatTimelineDiscoveryWelcome = {
    type: "discovery_welcome",
    key: CHAT_DISCOVERY_WELCOME_KEY,
  };

  const anchorSeparator = buildDateSeparatorItem(anchorIso);

  if (items.length === 0) {
    return [anchorSeparator, welcomeItem];
  }

  const first = items[0];
  if (first?.type === "date" && first.key === anchorSeparator.key) {
    return [first, welcomeItem, ...items.slice(1)];
  }

  return [anchorSeparator, welcomeItem, ...items];
}
