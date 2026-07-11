import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RejectProposalDialog } from "../RejectProposalDialog";

const mutateMock = vi.fn();
const scheduleSyncMock = vi.fn();

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({ contentRef: { current: null }, scheduleSync: scheduleSyncMock }),
}));

vi.mock("../../hooks/useProposalClientMutations", () => ({
  useRejectProposalMutation: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

describe("RejectProposalDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the reject form when open", () => {
    render(
      <RejectProposalDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    expect(screen.getByRole("heading", { name: "Recusar proposta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Motivo da recusa")).toBeInTheDocument();
    expect(screen.getByText("0/2000 caracteres")).toBeInTheDocument();
  });

  it("disables submit when proposalId is missing", () => {
    render(
      <RejectProposalDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId={null}
      />,
    );

    expect(screen.getByRole("button", { name: "Recusar proposta" })).toBeDisabled();
  });

  it("closes when cancel is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <RejectProposalDialog
        open
        onOpenChange={onOpenChange}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits the trimmed reason and closes on success", async () => {
    mutateMock.mockImplementation((_vars, options) => {
      options?.onSuccess?.();
    });
    const onOpenChange = vi.fn();

    render(
      <RejectProposalDialog
        open
        onOpenChange={onOpenChange}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    fireEvent.change(screen.getByLabelText("Motivo da recusa"), {
      target: { value: "  Valor acima do esperado  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Recusar proposta" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { proposalId: "proposal-1", rejectionReason: "Valor acima do esperado" },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit when the reason is empty", async () => {
    render(
      <RejectProposalDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Recusar proposta" }));

    await waitFor(() => {
      expect(screen.getByText("Descreva o motivo da recusa.")).toBeInTheDocument();
    });
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("resets the reason when the dialog reopens", async () => {
    const { rerender } = render(
      <RejectProposalDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    fireEvent.change(screen.getByLabelText("Motivo da recusa"), {
      target: { value: "Motivo antigo" },
    });
    expect(screen.getByLabelText("Motivo da recusa")).toHaveValue("Motivo antigo");

    rerender(
      <RejectProposalDialog
        open={false}
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );
    rerender(
      <RejectProposalDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Motivo da recusa")).toHaveValue("");
    });
  });
});
