import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProfileRole } from "@/features/auth";
import type { ProposalStatus } from "@/features/negotiation-proposals";
import { useAnalytics } from "@/hooks/useAnalytics";
import type { ChatMessageListItem, CnsConversationStatus } from "../types/chats.types";
import {
  hasMinimumProviderClientExchange,
  isChatInactiveForCloseBanner,
} from "../utils/chatActionBannerEligibility";
import {
  type ChatActionBannerAction,
  type ChatActionBannerModel,
  resolveChatActionBanner,
} from "../utils/chatActionBannerState";

export interface UseChatActionBannerStateParams {
  chatId: string | null;
  viewerRole: ProfileRole;
  conversationStatus: CnsConversationStatus;
  pendingProposalId?: string | null;
  revisionRequestedProposalId?: string | null;
  primaryProposalStatus?: ProposalStatus | null;
  messages?: readonly ChatMessageListItem[];
  clientId?: string | null;
  providerId?: string | null;
  lastInteractionAt?: string | null;
  enabled?: boolean;
}

export interface ChatActionBannerCtaPayload {
  action: ChatActionBannerAction;
  proposalId?: string;
}

export function useChatActionBannerState({
  chatId,
  viewerRole,
  conversationStatus,
  pendingProposalId = null,
  revisionRequestedProposalId = null,
  primaryProposalStatus = null,
  messages = [],
  clientId = null,
  providerId = null,
  lastInteractionAt = null,
  enabled = true,
}: UseChatActionBannerStateParams) {
  const { trackEvent } = useAnalytics();
  const [dismissedForVisit, setDismissedForVisit] = useState(false);
  const lastImpressionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setDismissedForVisit(false);
    lastImpressionKeyRef.current = null;
  }, [chatId]);

  const canShowSendProposalBanner = useMemo(() => {
    if (!clientId || !providerId) return false;
    return hasMinimumProviderClientExchange(messages, clientId, providerId);
  }, [clientId, messages, providerId]);

  const canShowCloseConversationBanner = useMemo(
    () => isChatInactiveForCloseBanner(lastInteractionAt),
    [lastInteractionAt],
  );

  const banner = useMemo(() => {
    if (!enabled || !chatId) return null;

    return resolveChatActionBanner({
      viewerRole,
      conversationStatus,
      pendingProposalId,
      revisionRequestedProposalId,
      primaryProposalStatus,
      canShowSendProposalBanner,
      canShowCloseConversationBanner,
    });
  }, [
    canShowCloseConversationBanner,
    canShowSendProposalBanner,
    chatId,
    conversationStatus,
    enabled,
    pendingProposalId,
    primaryProposalStatus,
    revisionRequestedProposalId,
    viewerRole,
  ]);

  const isVisible = Boolean(banner) && !dismissedForVisit;

  useEffect(() => {
    if (!isVisible || !banner || !chatId) return;

    const impressionKey = `${chatId}:${banner.action}:${banner.proposalId ?? ""}`;
    if (lastImpressionKeyRef.current === impressionKey) return;
    lastImpressionKeyRef.current = impressionKey;

    trackEvent("chat_action_banner_impression", {
      chat_id: chatId,
      action: banner.action,
      proposal_id: banner.proposalId,
    });
  }, [banner, chatId, isVisible, trackEvent]);

  const dismiss = useCallback(() => {
    setDismissedForVisit(true);
  }, []);

  const getCtaPayload = useCallback((): ChatActionBannerCtaPayload | null => {
    if (!banner) return null;
    return {
      action: banner.action,
      proposalId: banner.proposalId,
    };
  }, [banner]);

  return {
    banner,
    isVisible,
    dismiss,
    getCtaPayload,
  };
}

export type { ChatActionBannerModel };
