import { describe, expect, it } from "vitest";
import {
  getBudgetStatusConfig,
  getServiceRequestBudgetActionLabel,
  getServiceRequestBudgetSheetMode,
  getServiceRequestBudgetSheetTitle,
} from "../serviceRequestBudgetSheet";

describe("serviceRequestBudgetSheet constants", () => {
  it("maps proposal statuses for badges", () => {
    expect(getBudgetStatusConfig("accepted")).toMatchObject({
      label: "Aceito",
      variant: "success",
    });
    expect(getBudgetStatusConfig("REVISION_REQUESTED")).toMatchObject({
      label: "Revisão solicitada",
      variant: "warning",
    });
  });

  it("falls back for missing and unknown statuses", () => {
    expect(getBudgetStatusConfig(null)).toMatchObject({
      label: "Aguardando avaliação",
      variant: "warning",
    });
    expect(getBudgetStatusConfig(undefined)).toMatchObject({
      label: "Aguardando avaliação",
      variant: "warning",
    });
    expect(getBudgetStatusConfig("CUSTOM_STATUS")).toMatchObject({
      label: "CUSTOM_STATUS",
      variant: "secondary",
    });
  });

  it("uses compare mode for open service requests", () => {
    expect(getServiceRequestBudgetSheetMode("open")).toBe("compare");
    expect(getServiceRequestBudgetSheetTitle("compare")).toBe("Comparar orçamentos");
    expect(getServiceRequestBudgetActionLabel("open")).toBe("Comparar orçamentos");
  });

  it("uses history mode for non-open service requests", () => {
    expect(getServiceRequestBudgetSheetMode("in_progress")).toBe("history");
    expect(getServiceRequestBudgetSheetMode("closed")).toBe("history");
    expect(getServiceRequestBudgetSheetTitle("history")).toBe("Histórico de orçamentos");
    expect(getServiceRequestBudgetActionLabel("closed")).toBe("Histórico de orçamentos");
  });
});
