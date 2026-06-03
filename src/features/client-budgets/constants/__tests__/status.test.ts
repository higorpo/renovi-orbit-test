import { describe, expect, it } from "vitest";
import {
  formatReceivedExtraBudgetsLabel,
  getBudgetStatusConfig,
  getReceivedBudgetSheetMode,
  getReceivedBudgetSheetTitle,
  getReceivedBudgetSummaryLine,
  getReceivedCardCtaIcon,
  getReceivedCardCtaLabel,
  getReceivedExtraBudgetCount,
  getServiceBudgetFlowStatus,
  RECEIVED_FILTERS,
} from "../status";
import type { ReceivedStatusFilter } from "../../types/client-budgets.types";

describe("client-budgets status constants", () => {
  it("RECEIVED_FILTERS have ids and labels", () => {
    expect(RECEIVED_FILTERS.map((f) => f.id)).toEqual([
      "awaiting_decision",
      "accepted",
      "rejected",
    ]);
  });

  describe("getBudgetStatusConfig", () => {
    it("returns default when status is missing", () => {
      expect(getBudgetStatusConfig(null).label).toBe("Aguardando avaliação");
      expect(getBudgetStatusConfig(undefined).variant).toBe("warning");
    });

    it("maps known statuses case-insensitively", () => {
      expect(getBudgetStatusConfig("ACCEPTED")).toMatchObject({
        label: "Aceito",
        variant: "success",
      });
    });

    it("maps revised status label", () => {
      expect(getBudgetStatusConfig("REVISED")).toMatchObject({
        label: "Orçamento revisado",
        variant: "secondary",
      });
    });

    it("falls back for unknown status", () => {
      expect(getBudgetStatusConfig("custom")).toEqual({
        label: "custom",
        variant: "secondary",
      });
    });
  });

  describe("getServiceBudgetFlowStatus", () => {
    it("prioritizes accepted_count", () => {
      expect(
        getServiceBudgetFlowStatus({
          service_request_status: "open",
          submitted_count: 0,
          accepted_count: 1,
          total_budgets: 1,
        }).label,
      ).toBe("Orçamento aceito");
    });

    it("returns Encerrado for closed or cancelled request", () => {
      expect(
        getServiceBudgetFlowStatus({
          service_request_status: "closed",
          submitted_count: 2,
          accepted_count: 0,
          total_budgets: 2,
        }).variant,
      ).toBe("secondary");
      expect(
        getServiceBudgetFlowStatus({
          service_request_status: "cancelled",
          submitted_count: 1,
          accepted_count: 0,
          total_budgets: 1,
        }).label,
      ).toBe("Encerrado");
    });

    it("returns compare-ready when multiple submitted", () => {
      expect(
        getServiceBudgetFlowStatus({
          service_request_status: "open",
          submitted_count: 2,
          accepted_count: 0,
          total_budgets: 2,
        }).label,
      ).toBe("Pronto para comparar");
    });

    it("returns awaiting decision with any budget", () => {
      expect(
        getServiceBudgetFlowStatus({
          service_request_status: "open",
          submitted_count: 1,
          accepted_count: 0,
          total_budgets: 1,
        }).label,
      ).toBe("Aguardando decisão");
    });

    it("returns sem orçamentos when none", () => {
      expect(
        getServiceBudgetFlowStatus({
          service_request_status: "open",
          submitted_count: 0,
          accepted_count: 0,
          total_budgets: 0,
        }).label,
      ).toBe("Sem orçamentos");
    });
  });

  describe("sheet mode and title", () => {
    it("getReceivedBudgetSheetMode maps filter to mode", () => {
      expect(getReceivedBudgetSheetMode("awaiting_decision")).toBe("compare");
      expect(getReceivedBudgetSheetMode("accepted")).toBe("history");
    });

    it("getReceivedBudgetSheetTitle matches mode", () => {
      expect(getReceivedBudgetSheetTitle("compare")).toBe("Comparar orçamentos");
      expect(getReceivedBudgetSheetTitle("history")).toBe("Histórico de orçamentos");
    });
  });

  describe("CTA label and icon", () => {
    it("getReceivedCardCtaLabel uses singular copy when one submitted", () => {
      expect(getReceivedCardCtaLabel("awaiting_decision", 1)).toContain("detalhes");
      expect(getReceivedCardCtaLabel("awaiting_decision", 2)).toContain("Comparar");
      expect(getReceivedCardCtaLabel("accepted")).toContain("histórico");
    });

    it("getReceivedCardCtaIcon returns a component for each branch", () => {
      const details = getReceivedCardCtaIcon("awaiting_decision", 1);
      const compare = getReceivedCardCtaIcon("awaiting_decision", 2);
      const history = getReceivedCardCtaIcon("rejected");
      expect(details).toBeDefined();
      expect(compare).toBeDefined();
      expect(details).not.toBe(compare);
      expect(history).toBe(getReceivedCardCtaIcon("accepted"));
    });
  });

  describe("extra counts and labels", () => {
    const item = {
      total_budgets: 5,
      submitted_count: 4,
      accepted_count: 3,
      rejected_count: 4,
    };

    it("getReceivedExtraBudgetCount subtracts preview cap per filter", () => {
      expect(getReceivedExtraBudgetCount(item, "awaiting_decision")).toBe(2);
      expect(getReceivedExtraBudgetCount(item, "accepted")).toBe(1);
      expect(getReceivedExtraBudgetCount(item, "rejected")).toBe(2);
    });

    it("formatReceivedExtraBudgetsLabel is empty when no extras", () => {
      expect(formatReceivedExtraBudgetsLabel(0)).toBe("");
      expect(formatReceivedExtraBudgetsLabel(3)).toContain("outros");
    });

    it("getReceivedBudgetSummaryLine pluralizes correctly", () => {
      expect(getReceivedBudgetSummaryLine(item, "awaiting_decision")).toContain("4");
      expect(getReceivedBudgetSummaryLine({ ...item, accepted_count: 1 }, "accepted")).toContain(
        "aceito",
      );
      expect(getReceivedBudgetSummaryLine({ ...item, accepted_count: 2 }, "accepted")).toContain(
        "aceitos",
      );
      expect(getReceivedBudgetSummaryLine({ ...item, rejected_count: 1 }, "rejected")).toContain(
        "recusado",
      );
      expect(getReceivedBudgetSummaryLine({ ...item, rejected_count: 2 }, "rejected")).toContain(
        "recusados",
      );
    });

    it("getReceivedBudgetSummaryLine returns empty for invalid filter", () => {
      expect(getReceivedBudgetSummaryLine(item, "bad" as ReceivedStatusFilter)).toBe("");
    });
  });
});
