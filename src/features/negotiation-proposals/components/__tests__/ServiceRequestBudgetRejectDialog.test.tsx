import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceRequestBudgetRejectDialog } from "../ServiceRequestBudgetRejectDialog";

const mutateMock = vi.fn();

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({ contentRef: { current: null }, scheduleSync: vi.fn() }),
}));

vi.mock("../../hooks/useRejectServiceRequestBudgetProposal", () => ({
  useRejectServiceRequestBudgetProposal: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

describe("ServiceRequestBudgetRejectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the budget reject form when open", () => {
    render(
      <ServiceRequestBudgetRejectDialog
        open
        onOpenChange={vi.fn()}
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    expect(screen.getByRole("heading", { name: "Recusar orçamento" })).toBeInTheDocument();
    expect(screen.getByLabelText("Motivo da recusa")).toBeInTheDocument();
    expect(screen.getByText("0/2000")).toBeInTheDocument();
  });

  it("disables submit when proposalId is missing", () => {
    render(
      <ServiceRequestBudgetRejectDialog
        open
        onOpenChange={vi.fn()}
        serviceRequestId="sr-1"
        proposalId={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Enviar recusa" })).toBeDisabled();
  });

  it("submits the reason, resets the form, and closes on success", async () => {
    mutateMock.mockImplementation((_vars, options) => {
      options?.onSuccess?.();
    });
    const onOpenChange = vi.fn();

    render(
      <ServiceRequestBudgetRejectDialog
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    fireEvent.change(screen.getByLabelText("Motivo da recusa"), {
      target: { value: "  Prazo incompatível  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar recusa" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { proposalId: "proposal-1", reason: "Prazo incompatível" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit an empty reason", async () => {
    render(
      <ServiceRequestBudgetRejectDialog
        open
        onOpenChange={vi.fn()}
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar recusa" }));

    await waitFor(() => {
      expect(screen.getByText("Descreva o motivo da recusa.")).toBeInTheDocument();
    });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("closes when cancel is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ServiceRequestBudgetRejectDialog
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
