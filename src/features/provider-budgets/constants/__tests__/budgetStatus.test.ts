import { describe, expect, it } from "vitest";
import {
  BUDGET_STATUS_CONFIG,
  BUDGET_STATUS_FILTERS,
  QUESTION_STATUS_FILTERS,
  getBudgetStatusConfig,
  getQuestionStatusLabel,
  resolveQuestionStatus,
} from "../budgetStatus";

describe("budgetStatus", () => {
  describe("getBudgetStatusConfig", () => {
    it("returns config for known statuses", () => {
      expect(getBudgetStatusConfig("accepted")).toEqual(BUDGET_STATUS_CONFIG.accepted);
      expect(getBudgetStatusConfig("REJECTED")).toEqual(BUDGET_STATUS_CONFIG.rejected);
    });

    it("defaults to submitted when status is null or unknown", () => {
      expect(getBudgetStatusConfig(null)).toEqual(BUDGET_STATUS_CONFIG.submitted);
      expect(getBudgetStatusConfig(undefined)).toEqual(BUDGET_STATUS_CONFIG.submitted);
      expect(getBudgetStatusConfig("unknown")).toEqual(BUDGET_STATUS_CONFIG.submitted);
    });
  });

  describe("getQuestionStatusLabel", () => {
    it("returns cancelled / closed / in_progress labels from service request", () => {
      expect(
        getQuestionStatusLabel({
          client_response: null,
          service_request_status: "cancelled",
        }),
      ).toMatchObject({ label: "Pedido cancelado" });

      expect(
        getQuestionStatusLabel({
          client_response: "ok",
          service_request_status: "closed",
        }),
      ).toMatchObject({ label: "Pedido encerrado" });

      expect(
        getQuestionStatusLabel({
          client_response: null,
          service_request_status: "in_progress",
        }),
      ).toMatchObject({ label: "Pedido em andamento" });
    });

    it("returns answered when client_response is set and SR is open-like", () => {
      expect(
        getQuestionStatusLabel({
          client_response: "Sim",
          service_request_status: "open",
        }),
      ).toMatchObject({ label: "Respondida", variant: "success" });
    });

    it("returns pending when no response and SR is open-like", () => {
      expect(
        getQuestionStatusLabel({
          client_response: null,
          service_request_status: "open",
        }),
      ).toMatchObject({ label: "Aguardando resposta" });
    });
  });

  describe("resolveQuestionStatus", () => {
    it("returns closed for in_progress, closed, cancelled", () => {
      expect(
        resolveQuestionStatus({
          client_response: null,
          service_request_status: "in_progress",
        }),
      ).toBe("closed");
      expect(
        resolveQuestionStatus({
          client_response: "x",
          service_request_status: "closed",
        }),
      ).toBe("closed");
      expect(
        resolveQuestionStatus({
          client_response: null,
          service_request_status: "cancelled",
        }),
      ).toBe("closed");
    });

    it("returns answered when client responded and SR not closed-like", () => {
      expect(
        resolveQuestionStatus({
          client_response: "yes",
          service_request_status: "open",
        }),
      ).toBe("answered");
    });

    it("returns pending otherwise", () => {
      expect(
        resolveQuestionStatus({
          client_response: null,
          service_request_status: "open",
        }),
      ).toBe("pending");
    });

    it("treats null service request status as not closed-like", () => {
      expect(
        resolveQuestionStatus({
          client_response: null,
          service_request_status: null,
        }),
      ).toBe("pending");
    });
  });

  it("exposes filter option arrays", () => {
    expect(BUDGET_STATUS_FILTERS.some((f) => f.id === "all")).toBe(true);
    expect(QUESTION_STATUS_FILTERS.some((f) => f.id === "pending")).toBe(true);
  });
});
