import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PROPOSAL_REVISIONS } from "../../constants/proposalRevisions";
import { RevisionRequestDialog } from "../RevisionRequestDialog";

const mutateMock = vi.fn();

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({ contentRef: { current: null }, scheduleSync: vi.fn() }),
}));

vi.mock("../../hooks/useProposalClientMutations", () => ({
  useRequestProposalRevisionMutation: () => ({
    mutate: mutateMock,
    isPending: false,
  }),
}));

describe("RevisionRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reason options and revision counter", () => {
    render(
      <RevisionRequestDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
        revisionCount={1}
      />,
    );

    expect(screen.getByRole("heading", { name: "Pedir revisão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Motivo")).toBeInTheDocument();
    expect(screen.getByText(/Revisões solicitadas:/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the loading skeleton while initial values load", () => {
    render(
      <RevisionRequestDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
        revisionCount={0}
        isLoading
      />,
    );

    expect(screen.getByRole("button", { name: "Solicitar revisão" })).toBeDisabled();
  });

  it("applies initial values when the dialog opens", async () => {
    render(
      <RevisionRequestDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
        revisionCount={0}
        initialValues={{
          revisionReason: "PRICE_TOO_HIGH",
          revisionNotes: "Precisa baixar o valor",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Motivo")).toHaveValue("PRICE_TOO_HIGH");
    });
    expect(screen.getByLabelText("Observações (opcional)")).toHaveValue("Precisa baixar o valor");
  });

  it("submits revision reason and notes then closes", async () => {
    mutateMock.mockImplementation((_vars, options) => {
      options?.onSuccess?.();
    });
    const onOpenChange = vi.fn();

    render(
      <RevisionRequestDialog
        open
        onOpenChange={onOpenChange}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
        revisionCount={0}
      />,
    );

    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "CHANGE_TIMELINE" },
    });
    fireEvent.change(screen.getByLabelText("Observações (opcional)"), {
      target: { value: "  Preciso de outra data  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar revisão" }));

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        {
          proposalId: "proposal-1",
          revisionReason: "CHANGE_TIMELINE",
          revisionNotes: "Preciso de outra data",
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables submit when the revision limit is reached", () => {
    render(
      <RevisionRequestDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
        revisionCount={MAX_PROPOSAL_REVISIONS}
      />,
    );

    expect(screen.getByRole("button", { name: "Solicitar revisão" })).toBeDisabled();
    expect(screen.getByLabelText("Motivo")).toBeDisabled();
    expect(screen.getByLabelText("Observações (opcional)")).toBeDisabled();
  });

  it("closes when cancel is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <RevisionRequestDialog
        open
        onOpenChange={onOpenChange}
        chatId="chat-1"
        serviceRequestId="sr-1"
        proposalId="proposal-1"
        revisionCount={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
