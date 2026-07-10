import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  AcceptRescheduleDialog,
  CancelRescheduleDialog,
  RequestAdjustmentRescheduleDialog,
} from "../RescheduleActionDialogs";

const acceptMutateAsync = vi.fn();
const cancelMutateAsync = vi.fn();
const adjustmentMutateAsync = vi.fn();
const acceptPending = vi.hoisted(() => ({ value: false }));
const detailState = vi.hoisted(() => ({
  snapshot: {
    activeRequest: {
      proposed_slot: {
        start_date: "2030-06-20",
        end_date: null as string | null,
        shift: "morning" as const,
      },
    },
  } as {
    activeRequest: {
      proposed_slot: {
        start_date: string;
        end_date: string | null;
        shift: "morning" | "afternoon" | "full_day";
      } | null;
    };
  } | null,
  isLoading: false,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../hooks/useServiceRescheduleMutations", () => ({
  useServiceRescheduleMutations: () => ({
    acceptReschedule: {
      mutateAsync: acceptMutateAsync,
      isPending: acceptPending.value,
    },
    cancelReschedule: { mutateAsync: cancelMutateAsync, isPending: false },
    requestAdjustment: { mutateAsync: adjustmentMutateAsync, isPending: false },
  }),
}));

vi.mock("../../hooks/useRescheduleRequestDetail", () => ({
  useRescheduleRequestDetail: () => ({
    snapshot: detailState.snapshot,
    isLoading: detailState.isLoading,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  acceptPending.value = false;
  detailState.isLoading = false;
  detailState.snapshot = {
    activeRequest: {
      proposed_slot: {
        start_date: "2030-06-20",
        end_date: null,
        shift: "morning",
      },
    },
  };
  acceptMutateAsync.mockResolvedValue({});
  cancelMutateAsync.mockResolvedValue({});
  adjustmentMutateAsync.mockResolvedValue({});
});

describe("AcceptRescheduleDialog", () => {
  it("confirms accept and notifies success", async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <AcceptRescheduleDialog
        open
        onOpenChange={onOpenChange}
        rescheduleRequestId="req-1"
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText(/execução passará/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar nova data" }));

    await waitFor(() => expect(acceptMutateAsync).toHaveBeenCalledWith({ rescheduleRequestId: "req-1" }));
    expect(toast.success).toHaveBeenCalledWith("Reagendamento confirmado.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("shows loading copy while snapshot is fetching", () => {
    detailState.isLoading = true;
    detailState.snapshot = null;

    render(
      <AcceptRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    expect(screen.getByText(/Carregando detalhes da proposta/i)).toBeInTheDocument();
  });

  it("falls back to generic confirm copy when proposed slot is missing", () => {
    detailState.snapshot = { activeRequest: { proposed_slot: null } };

    render(
      <AcceptRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    expect(
      screen.getByText(/Confirme para aplicar a nova data proposta pelo prestador/i),
    ).toBeInTheDocument();
  });

  it("toasts API errors on accept failure", async () => {
    acceptMutateAsync.mockRejectedValue(new Error("Selecione uma data válida."));

    render(
      <AcceptRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar nova data" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Selecione uma data válida."),
    );
  });

  it("toasts generic accept failure for non-Error throws", async () => {
    acceptMutateAsync.mockRejectedValue("boom");

    render(
      <AcceptRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirmar nova data" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao confirmar reagendamento."),
    );
  });

  it("does not accept when request id is missing", () => {
    render(<AcceptRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId={null} />);

    const confirm = screen.getByRole("button", { name: "Confirmar nova data" });
    expect(confirm).toBeDisabled();
  });
});

describe("CancelRescheduleDialog", () => {
  it("cancels the request and closes on success", async () => {
    const onOpenChange = vi.fn();

    render(
      <CancelRescheduleDialog open onOpenChange={onOpenChange} rescheduleRequestId="req-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar solicitação" }));

    await waitFor(() =>
      expect(cancelMutateAsync).toHaveBeenCalledWith({ rescheduleRequestId: "req-1" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Solicitação de reagendamento cancelada.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("toasts cancel failures", async () => {
    cancelMutateAsync.mockRejectedValue(new Error("Falha ao cancelar"));

    render(
      <CancelRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar solicitação" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha ao cancelar"));
  });

  it("toasts generic cancel failure for non-Error throws", async () => {
    cancelMutateAsync.mockRejectedValue(42);

    render(
      <CancelRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar solicitação" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao cancelar solicitação."),
    );
  });
});

describe("RequestAdjustmentRescheduleDialog", () => {
  it("requests adjustment and notifies success", async () => {
    const onSuccess = vi.fn();

    render(
      <RequestAdjustmentRescheduleDialog
        open
        onOpenChange={vi.fn()}
        rescheduleRequestId="req-1"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }));

    await waitFor(() =>
      expect(adjustmentMutateAsync).toHaveBeenCalledWith({ rescheduleRequestId: "req-1" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Pedido de ajuste enviado.");
    expect(onSuccess).toHaveBeenCalled();
  });

  it("toasts adjustment failures", async () => {
    adjustmentMutateAsync.mockRejectedValue("boom");

    render(
      <RequestAdjustmentRescheduleDialog
        open
        onOpenChange={vi.fn()}
        rescheduleRequestId="req-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pedir ajuste" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha ao pedir ajuste."));
  });
});
