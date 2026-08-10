import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { getChatsPageUrlWithServiceRequestFilter } from "@/features/chats";
import { openGoogleMaps } from "@/lib/maps/openGoogleMaps";
import { SERVICE_PROVIDER_PROPOSAL_SECTION_ID } from "../constants/serviceDetailNextStep.constants";
import { SERVICE_DETAIL_QUERY_KEY, SERVICES_LIST_QUERY_KEY } from "../constants/queryKeys";
import { useClientCardManualPaymentBridge } from "./useClientCardManualPaymentBridge";
import { getServiceCoordinates } from "../utils/serviceLocation";
import { getServiceNextStep, type ServiceNextStep } from "../utils/serviceNextStep";
import type { ServiceModel } from "../types/service.types";

export interface UseServiceDetailNextStepParams {
  model: ServiceModel | null | undefined;
  role: "client" | "provider" | string | null | undefined;
  openBudgetSheet: (model: ServiceModel) => void;
  openProviderChat?: () => void;
  isOpeningProviderChat?: boolean;
  onCompletionSuccess?: () => void;
}

export interface UseServiceDetailNextStepResult {
  step: ServiceNextStep | null;
  handleAction: () => void;
  actionDisabled: boolean;
  evaluateOpen: boolean;
  setEvaluateOpen: (open: boolean) => void;
  markExecutedOpen: boolean;
  setMarkExecutedOpen: (open: boolean) => void;
  ratingOnly: boolean;
  invalidateServiceQueries: () => void;
  manualPayment: ReturnType<typeof useClientCardManualPaymentBridge>;
  needsManualPayment: boolean;
}

/**
 * Resolves the detail "Próximo passo" card and wires intents to existing detail flows.
 * Overlay sheets stay in a sibling component to avoid a barrel cycle with service-completion.
 */
export function useServiceDetailNextStep({
  model,
  role,
  openBudgetSheet,
  openProviderChat,
  isOpeningProviderChat = false,
  onCompletionSuccess,
}: UseServiceDetailNextStepParams): UseServiceDetailNextStepResult {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const step = useMemo(
    () => (model ? getServiceNextStep(model, role) : null),
    [model, role],
  );

  const needsManualPayment =
    role === "client" &&
    step?.intent === "adjust_payment" &&
    Boolean(model?.contracted?.id);
  const manualPayment = useClientCardManualPaymentBridge(
    needsManualPayment ? (model?.contracted?.id ?? null) : null,
  );

  const [evaluateOpen, setEvaluateOpen] = useState(false);
  const [markExecutedOpen, setMarkExecutedOpen] = useState(false);

  const invalidateServiceQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: SERVICES_LIST_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: SERVICE_DETAIL_QUERY_KEY });
    onCompletionSuccess?.();
  }, [onCompletionSuccess, queryClient]);

  const scrollToProposalSection = useCallback(() => {
    requestAnimationFrame(() => {
      document
        .getElementById(SERVICE_PROVIDER_PROPOSAL_SECTION_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleAction = useCallback(() => {
    if (!model || !step || step.disabled) return;

    switch (step.intent) {
      case "adjust_payment":
        manualPayment.openModal();
        return;
      case "evaluate_service":
        setEvaluateOpen(true);
        return;
      case "budgets":
        openBudgetSheet(model);
        return;
      case "messages":
        void navigate(getChatsPageUrlWithServiceRequestFilter(model.id));
        return;
      case "chat": {
        if (role === "provider") {
          openProviderChat?.();
          return;
        }
        const chatId = model.chatSummary?.id ?? model.contracted?.chatId;
        if (!chatId) return;
        void navigate(`/dashboard/chats/${chatId}`);
        return;
      }
      case "mark_executed":
        setMarkExecutedOpen(true);
        return;
      case "revise_proposal":
      case "view_proposal":
        scrollToProposalSection();
        return;
      case "open_map": {
        const coordinates = getServiceCoordinates(model.address);
        if (!coordinates) return;
        openGoogleMaps(coordinates);
        return;
      }
    }
  }, [
    manualPayment,
    model,
    navigate,
    openBudgetSheet,
    openProviderChat,
    role,
    scrollToProposalSection,
    step,
  ]);

  const actionDisabled =
    Boolean(step?.disabled) ||
    (step?.intent === "chat" && role === "provider" && isOpeningProviderChat) ||
    (step?.intent === "adjust_payment" && manualPayment.isLoading);

  const ratingOnly =
    model?.contracted?.status === "COMPLETED" &&
    model.contracted.clientRatingOverallScore == null;

  return {
    step,
    handleAction,
    actionDisabled,
    evaluateOpen,
    setEvaluateOpen,
    markExecutedOpen,
    setMarkExecutedOpen,
    ratingOnly,
    invalidateServiceQueries,
    manualPayment,
    needsManualPayment,
  };
}
