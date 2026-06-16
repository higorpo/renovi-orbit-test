import { useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  createClientMyServicesServiceDetailState,
  getServiceDetailPath,
  statusToTabId,
  useServiceRequestBudgetSheet,
  type ServiceModel,
} from "@/features/view-services";
import { getChatsPageUrlWithServiceRequestFilter } from "@/features/chats";
import { useMyServicesPageCore } from "./useMyServicesPageCore";
import { useClientMyServicesCancel } from "./useClientMyServicesCancel";
import { SERVICE_REQUEST_FOCUS_QUERY } from "../constants/routes";

export function useClientMyServicesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusServiceRequestId = searchParams.get(SERVICE_REQUEST_FOCUS_QUERY);
  const { cancelServiceRequest, isCancelling } = useClientMyServicesCancel();

  const core = useMyServicesPageCore({ serviceRequestId: focusServiceRequestId });

  const {
    budgetSheetOpen,
    setBudgetSheetOpen,
    selectedServiceRequestId,
    selectedBudgetSheetMode,
    openBudgetSheet,
  } = useServiceRequestBudgetSheet();

  const hasActiveFilters =
    core.hasActiveFilters || Boolean(focusServiceRequestId);

  const focusedRequest = useMemo(() => {
    if (!focusServiceRequestId) return null;
    return core.items.find((m) => m.id === focusServiceRequestId) ?? null;
  }, [focusServiceRequestId, core.items]);

  useEffect(() => {
    if (!focusServiceRequestId || !focusedRequest) return;
    core.setStatusTabId(statusToTabId(focusedRequest.listPhase));
  }, [focusServiceRequestId, focusedRequest, core.setStatusTabId]);

  const scrolledToFocusIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusServiceRequestId) {
      scrolledToFocusIdRef.current = null;
      return;
    }
    if (core.isLoading || core.items.length !== 1) return;
    if (scrolledToFocusIdRef.current === focusServiceRequestId) return;
    scrolledToFocusIdRef.current = focusServiceRequestId;
    requestAnimationFrame(() => {
      document
        .getElementById(`service-request-${focusServiceRequestId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusServiceRequestId, core.items.length, core.isLoading]);

  const handleClearFocusFilter = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(SERVICE_REQUEST_FOCUS_QUERY);
      return next;
    });
  }, [setSearchParams]);

  const handleClearFilters = useCallback(() => {
    core.handleClearFilters();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(SERVICE_REQUEST_FOCUS_QUERY);
      return next;
    });
  }, [core.handleClearFilters, setSearchParams]);

  const handleOpenBudgets = useCallback(
    (model: ServiceModel) => {
      openBudgetSheet(model);
    },
    [openBudgetSheet],
  );

  const handleOpenDetails = useCallback(
    (model: ServiceModel) => {
      navigate(getServiceDetailPath(model.id), {
        state: createClientMyServicesServiceDetailState(location),
      });
    },
    [location, navigate],
  );

  const handleOpenMessages = useCallback(
    (model: ServiceModel) => {
      navigate(getChatsPageUrlWithServiceRequestFilter(model.id));
    },
    [navigate],
  );

  const handleOpenChat = useCallback(
    (model: ServiceModel) => {
      const chatId = model.chatSummary?.id;
      if (!chatId) return;
      navigate(`/dashboard/chats/${chatId}`);
    },
    [navigate],
  );

  useEffect(() => {
    if (!budgetSheetOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [budgetSheetOpen]);

  return {
    ...core,
    hasActiveFilters,
    focusServiceRequestId,
    focusedRequest,
    budgetSheetOpen,
    setBudgetSheetOpen,
    selectedServiceRequestId,
    selectedBudgetSheetMode,
    cancelServiceRequest,
    isCancelling,
    handleClearFocusFilter,
    handleClearFilters,
    handleOpenBudgets,
    handleOpenDetails,
    handleOpenMessages,
    handleOpenChat,
  };
}
