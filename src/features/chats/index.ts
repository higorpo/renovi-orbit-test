/**
 * Chats feature — Public API (design §13.9).
 *
 * Only the exports below are intended for use outside this feature.
 * Do not import from api/, hooks/, components/, types/, or utils/ paths directly.
 */

// API layer — RPC wrappers (design §5.3)
export { CNS_CHAT_RPC, type CnsChatRpcName } from "./api/chats.rpc";
export {
  chatsApi,
  checkChatFreeMessagingAllowed,
  closeConversation,
  getConversationDetail,
  listChatMessages,
  listConversations,
  markConversationRead,
  findProviderChatForServiceRequest,
  initiateConversation,
  sendMessage,
} from "./api/chats.api";

// Hooks — observability and analytics (Phase 13)
export {
  clearChatSentryContext,
  setChatSentryContext,
  useChatSentryContext,
  type ChatSentryContext,
} from "./hooks/useChatSentryContext";
export { useChatAnalytics, type ChatAnalyticsTrackers } from "./hooks/useChatAnalytics";
export { useChatMessages, type SendChatMessageInput } from "./hooks/useChatMessages";
export {
  useConversationRealtime,
  isRealtimeConnectionHealthy,
  type UseConversationRealtimeOptions,
} from "./hooks/useConversationRealtime";
export {
  useConversationPollingFallback,
  CHAT_POLLING_FALLBACK_INTERVAL_MS,
  CHAT_POLLING_MIN_INTERVAL_MS,
  type UseConversationPollingFallbackParams,
} from "./hooks/useConversationPollingFallback";
export { usePushNotificationSuppression } from "./hooks/usePushNotificationSuppression";
export { useChatComposerState, type UseChatComposerStateParams } from "./hooks/useChatComposerState";
export {
  deriveChatComposerState,
  CHAT_COMPOSER_DISABLED_COPY,
  CHAT_COMPOSER_PLACEHOLDER_ENABLED,
  type ChatComposerState,
  type ChatComposerDisabledReason,
} from "./utils/composerState";
export {
  resolveChatActionBanner,
  type ChatActionBannerModel,
  type ChatActionBannerAction,
  type ChatActionBannerContext,
} from "./utils/chatActionBannerState";
export {
  useChatActionBannerState,
  type UseChatActionBannerStateParams,
  type ChatActionBannerCtaPayload,
} from "./hooks/useChatActionBannerState";
export {
  ChatActionBanner,
  ChatActionBannerSlot,
  type ChatActionBannerProps,
} from "./components/ChatActionBanner/ChatActionBanner";
export { ChatListItem, type ChatListItemProps } from "./components/ChatListItem/ChatListItem";
export { ChatListItemSkeleton } from "./components/ChatListItem/ChatListItemSkeleton";
export {
  ServiceRequestConversationList,
  type ServiceRequestConversationListProps,
} from "./components/ServiceRequestConversationList/ServiceRequestConversationList";
export {
  ServiceRequestContractedChatButton,
  type ServiceRequestContractedChatButtonProps,
} from "./components/ServiceRequestContractedChatButton/ServiceRequestContractedChatButton";
export { ChatListPage, type ChatListPageProps } from "./components/ChatListPage/ChatListPage";
export { useChatConversations } from "./hooks/useChatConversations";
export { useChatListServiceRequestFilter } from "./hooks/useChatListServiceRequestFilter";
export {
  ROUTE_CHATS_LIST,
  CHAT_SERVICE_REQUEST_FILTER_QUERY,
  getChatsPageUrlWithServiceRequestFilter,
} from "./constants/routes";
export { ChatsLayout } from "./components/ChatsLayout/ChatsLayout";
export { ChatsConversationRoute } from "./components/ChatsLayout/ChatsConversationRoute";
export { ChatScreen, type ChatScreenProps } from "./components/ChatScreen/ChatScreen";
export { ChatScreenHeader, type ChatScreenHeaderProps } from "./components/ChatScreen/ChatScreenHeader";
export { ChatTimeline, type ChatTimelineProps } from "./components/ChatScreen/ChatTimeline";
export { useConversationDetail } from "./hooks/useConversationDetail";
export { useCloseConversationMutation } from "./hooks/useCloseConversationMutation";
export { buildChatTimelineItems, type ChatTimelineItem } from "./utils/groupChatTimeline";
export {
  DynamicMessageRenderer,
  type DynamicMessageRendererProps,
} from "./components/DynamicMessageRenderer/DynamicMessageRenderer";
export {
  DynamicProposalCard,
  type DynamicProposalCardProps,
  type ProposalCardAction,
} from "./components/DynamicMessageRenderer/DynamicProposalCard";
export { useProposalTimelineHydration } from "./hooks/useProposalTimelineHydration";
export {
  CHAT_MESSAGES_QUERY_KEY,
  CONVERSATION_DETAIL_QUERY_KEY,
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY,
  CHAT_FREE_MESSAGING_QUERY_KEY,
  PROVIDER_SERVICE_CHAT_QUERY_KEY,
} from "./constants/queryKeys";

// Types — RPC JSON shapes and generated enum aliases
export type {
  CnsClosureType,
  CnsConversationStatus,
  CnsDeliveryStatus,
  CnsInactivationReason,
  CnsMessageType,
  ChatRow,
  ChatMessageRow,
  ConversationCounterparty,
  ConversationServiceSummary,
  ConversationLastMessagePreview,
  ConversationListItem,
  ConversationListCursor,
  ConversationListResponse,
  ChatMessageCursor,
  ChatMessageListItem,
  ChatMessageListResponse,
  ConversationDetailSnapshot,
  ConversationDetailResponse,
  CloseConversationResult,
  ConversationServiceRequestSummary,
  ConversationCategorySummary,
  SendMessageResult,
  SendMessageResultMessage,
  SendMessageResultConversation,
  InitiateConversationResult,
  ProviderServiceChatLookup,
  MarkConversationReadResult,
  CnsBusinessErrorCode,
  ChatsApiError,
  ChatsApiResult,
} from "./types/chats.types";

export { mapCnsRpcError } from "./utils/chatApiErrors";

// Utils — cursor reconciliation and Sentry scrubbing for cross-cutting lib use
export { mergeKeysetMessagePages, type KeysetIdentified } from "./utils/cursorMerge";
export {
  isChatSentryFeature,
  scrubChatBreadcrumbData,
  scrubChatSentryEvent,
  scrubChatSensitiveData,
  scrubMessagePayload,
} from "./utils/sentryChatScrubbing";
