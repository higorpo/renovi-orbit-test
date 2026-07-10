import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { RequestRescheduleDialog } from "../RequestRescheduleDialog";

const mutateAsync = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: { current: null },
    scheduleSync: vi.fn(),
  }),
}));

vi.mock("../../hooks/useServiceRescheduleMutations", () => ({
  useServiceRescheduleMutations: () => ({
    requestReschedule: { mutateAsync, isPending: false },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({ chat_id: "chat-1" });
});

describe("RequestRescheduleDialog", () => {
  it("submits optional note and reports chat id on success", async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <RequestRescheduleDialog
        open
        onOpenChange={onOpenChange}
        contractedServiceId="cs-1"
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Explique o motivo/i), {
      target: { value: " Prefiro tarde " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar reagendamento" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        contractedServiceId: "cs-1",
        requestNote: "Prefiro tarde",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Solicitação de reagendamento enviada.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalledWith("chat-1");
  });

  it("sends null note when observation is blank", async () => {
    render(
      <RequestRescheduleDialog open onOpenChange={vi.fn()} contractedServiceId="cs-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Solicitar reagendamento" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        contractedServiceId: "cs-1",
        requestNote: null,
      }),
    );
  });

  it("toasts mutation errors", async () => {
    mutateAsync.mockRejectedValue(new Error("Já existe uma solicitação"));

    render(
      <RequestRescheduleDialog open onOpenChange={vi.fn()} contractedServiceId="cs-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Solicitar reagendamento" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Já existe uma solicitação"),
    );
  });

  it("toasts generic failure for non-Error throws", async () => {
    mutateAsync.mockRejectedValue("boom");

    render(
      <RequestRescheduleDialog open onOpenChange={vi.fn()} contractedServiceId="cs-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Solicitar reagendamento" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao solicitar reagendamento."),
    );
  });

  it("closes when Cancelar is pressed", () => {
    const onOpenChange = vi.fn();

    render(
      <RequestRescheduleDialog open onOpenChange={onOpenChange} contractedServiceId="cs-1" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
