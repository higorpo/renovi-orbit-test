import { describe, expect, it } from "vitest";
import { GitCompare, History } from "lucide-react";
import {
  getServiceRequestBudgetActionIcon,
  getServiceRequestBudgetActionLabel,
  getServiceRequestBudgetActionState,
  getServiceRequestBudgetSheetMode,
} from "../serviceRequestBudgetAction";

describe("serviceRequestBudgetAction", () => {
  it("uses compare labels during negotiation", () => {
    expect(
      getServiceRequestBudgetActionLabel({ proposalCount: 1, listPhase: "negotiation" }),
    ).toBe("Ver orçamento");
    expect(
      getServiceRequestBudgetActionLabel({ proposalCount: 3, listPhase: "negotiation" }),
    ).toBe("Comparar orçamentos");
    expect(getServiceRequestBudgetSheetMode("negotiation")).toBe("compare");
  });

  it("uses history labels after negotiation", () => {
    expect(
      getServiceRequestBudgetActionLabel({ proposalCount: 1, listPhase: "completed" }),
    ).toBe("Ver histórico");
    expect(
      getServiceRequestBudgetActionLabel({ proposalCount: 2, listPhase: "in_progress" }),
    ).toBe("Histórico de orçamentos");
    expect(getServiceRequestBudgetSheetMode("completed")).toBe("history");
  });

  it("disables the action when there are no proposals", () => {
    expect(
      getServiceRequestBudgetActionState({
        proposalCount: 0,
        listPhase: "negotiation",
      }),
    ).toMatchObject({
      disabled: true,
      disabledReason: "Nenhum orçamento recebido ainda",
    });
  });

  it("enables the action when proposals exist", () => {
    expect(
      getServiceRequestBudgetActionState({
        proposalCount: 2,
        listPhase: "negotiation",
      }),
    ).toMatchObject({
      disabled: false,
      disabledReason: undefined,
      sheetMode: "compare",
      label: "Comparar orçamentos",
    });
  });

  it("picks compare vs history icons by list phase", () => {
    expect(getServiceRequestBudgetActionIcon("negotiation")).toBe(GitCompare);
    expect(getServiceRequestBudgetActionIcon("completed")).toBe(History);
  });
});
