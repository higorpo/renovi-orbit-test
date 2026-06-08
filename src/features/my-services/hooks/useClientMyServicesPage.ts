import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  getServiceDetailPath,
  statusToTabId,
  type ServiceModel,
} from "@/features/view-services";
import type { ServiceRequestBudgetSheetMode } from "@/features/negotiation-proposals";
import { useMyServicesPageCore } from "./useMyServicesPageCore";
import { useClientMyServicesCancel } from "./useClientMyServicesCancel";
import { SERVICE_REQUEST_FOCUS_QUERY } from "../constants/routes";

export function useClientMyServicesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusServiceRequestId = searchParams.get(SERVICE_REQUEST_FOCUS_QUERY);
  const { cancelServiceRequest, isCancelling } = useClientMyServicesCancel();

  const core = useMyServicesPageCore({ serviceRequestId: focusServiceRequestId });

  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<string | null>(null);
  const [selectedBudgetSheetMode, setSelectedBudgetSheetMode] =
    useState<ServiceRequestBudgetSheetMode>("compare");

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

  const handleOpenBudgets = useCallback((model: ServiceModel) => {
    setSelectedServiceRequestId(model.id);
    setSelectedBudgetSheetMode(model.listPhase === "negotiation" ? "compare" : "history");
    setBudgetSheetOpen(true);
  }, []);

  const handleOpenDetails = useCallback(
    (model: ServiceModel) => {
      navigate(getServiceDetailPath(model.id));
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
  };
}
