import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetRejectReasonDialog } from "../BudgetRejectReasonDialog";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  rejectClientBudgetProposal: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));


vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: { current: null },
    scheduleSync: vi.fn(),
  }),
}));

const rejectClientBudgetProposal = vi.mocked(clientBudgetsApi.rejectClientBudgetProposal);

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    createElement(QueryClientProvider, { client }, ui) as ReactElement,
  );
}

describe("BudgetRejectReasonDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rejectClientBudgetProposal.mockResolvedValue({ error: null, data: {} });
  });

  it("validates empty reason on submit", async () => {
    const onOpenChange = vi.fn();
    renderWithClient(
      <BudgetRejectReasonDialog
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
        proposalId="p1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Enviar recusa/i }));
    expect(await screen.findByText(/Descreva o motivo da recusa/i)).toBeInTheDocument();
    expect(rejectClientBudgetProposal).not.toHaveBeenCalled();
  });

  it("submits trimmed reason and closes on success", async () => {
    const onOpenChange = vi.fn();
    renderWithClient(
      <BudgetRejectReasonDialog
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
        proposalId="p1"
      />,
    );

    fireEvent.change(screen.getByLabelText(/Motivo da recusa/i), {
      target: { value: "  Preço alto  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar recusa/i }));

    await waitFor(() => {
      expect(rejectClientBudgetProposal).toHaveBeenCalledWith({
        proposalId: "p1",
        reason: "Preço alto",
      });
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
