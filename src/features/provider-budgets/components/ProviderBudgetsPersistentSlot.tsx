import { useLocation } from "react-router";
import { useServiceDetailModal } from "@/features/view-services";
import { ProviderBudgetsPage } from "./ProviderBudgetsPage";

/**
 * Keeps the budgets list mounted when opening service detail as a sheet from Orçamentos.
 */
export function ProviderBudgetsPersistentSlot() {
  const location = useLocation();
  const modal = useServiceDetailModal();
  const visible =
    location.pathname === "/dashboard/budgets" ||
    (modal.isFromProviderBudgets && modal.background?.pathname === "/dashboard/budgets");

  if (!visible) {
    return null;
  }

  return <ProviderBudgetsPage />;
}
