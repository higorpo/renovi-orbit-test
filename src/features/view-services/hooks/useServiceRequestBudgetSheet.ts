import { useCallback, useState } from "react";
import type { ServiceModel } from "../types/service.types";
import {
  getServiceRequestBudgetSheetMode,
  type ServiceRequestBudgetSheetMode,
} from "../utils/serviceRequestBudgetAction";

export function useServiceRequestBudgetSheet() {
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const [selectedServiceRequestId, setSelectedServiceRequestId] = useState<string | null>(null);
  const [selectedBudgetSheetMode, setSelectedBudgetSheetMode] =
    useState<ServiceRequestBudgetSheetMode>("compare");

  const openBudgetSheet = useCallback((model: Pick<ServiceModel, "id" | "listPhase">) => {
    setSelectedServiceRequestId(model.id);
    setSelectedBudgetSheetMode(getServiceRequestBudgetSheetMode(model.listPhase));
    setBudgetSheetOpen(true);
  }, []);

  return {
    budgetSheetOpen,
    setBudgetSheetOpen,
    selectedServiceRequestId,
    selectedBudgetSheetMode,
    openBudgetSheet,
  };
}
