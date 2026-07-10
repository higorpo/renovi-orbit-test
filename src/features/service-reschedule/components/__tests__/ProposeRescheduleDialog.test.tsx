import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ProposeRescheduleDialog } from "../ProposeRescheduleDialog";

const mutateAsync = vi.fn();

const snapshot = {
  contractedServiceId: "cs-1",
  durationUnit: "hours" as const,
  durationValue: 4,
  activeRequest: { id: "req-1" },
};

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useMobileDialogViewport", () => ({
  useMobileDialogViewport: () => ({
    contentRef: { current: null },
    scheduleSync: vi.fn(),
  }),
}));

vi.mock("@/lib/utils/calendarDate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/calendarDate")>();
  return {
    ...actual,
    todayCalendarIso: () => "2030-06-01",
    addCalendarDaysIso: (iso: string, days: number) => {
      const date = new Date(`${iso}T12:00:00`);
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    },
  };
});

vi.mock("../../hooks/useServiceRescheduleMutations", () => ({
  useServiceRescheduleMutations: () => ({
    proposeReschedule: { mutateAsync, isPending: false },
  }),
}));

vi.mock("../../hooks/useRescheduleRequestDetail", () => ({
  useRescheduleRequestDetail: () => ({
    snapshot,
    isLoading: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({});
});

describe("ProposeRescheduleDialog", () => {
  it("submits a proposed slot for hourly services", async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <ProposeRescheduleDialog
        open
        onOpenChange={onOpenChange}
        rescheduleRequestId="req-1"
        onSuccess={onSuccess}
      />,
    );

    await waitFor(() =>
      expect(document.getElementById("reschedule-start-date")).toBeInTheDocument(),
    );

    fireEvent.change(document.getElementById("reschedule-start-date")!, {
      target: { value: "2030-06-10" },
    });
    fireEvent.change(document.getElementById("reschedule-shift")!, {
      target: { value: "afternoon" },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enviar proposta" })).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        rescheduleRequestId: "req-1",
        newSlot: {
          start_date: "2030-06-10",
          end_date: null,
          shift: "afternoon",
          duration_unit: "hours",
          duration_value: 4,
        },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Nova data proposta com sucesso.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalled();
  });

  it("toasts propose failures", async () => {
    mutateAsync.mockRejectedValue(new Error("Selecione um turno válido."));

    render(
      <ProposeRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    await waitFor(() =>
      expect(document.getElementById("reschedule-start-date")).toBeInTheDocument(),
    );

    fireEvent.change(document.getElementById("reschedule-start-date")!, {
      target: { value: "2030-06-10" },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enviar proposta" })).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Selecione um turno válido."),
    );
  });

  it("dismisses the flow reminder", async () => {
    render(
      <ProposeRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    await waitFor(() =>
      expect(screen.getByText("Como funciona o reagendamento?")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Dispensar lembrete de reagendamento" }),
    );

    expect(screen.queryByText("Como funciona o reagendamento?")).not.toBeInTheDocument();
  });

  it("shows end date field for multi-day duration and clears it when switching to hours", async () => {
    render(
      <ProposeRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    await waitFor(() =>
      expect(document.getElementById("reschedule-duration-unit")).toBeInTheDocument(),
    );

    fireEvent.change(document.getElementById("reschedule-duration-unit")!, {
      target: { value: "days" },
    });
    fireEvent.change(document.getElementById("reschedule-duration-value")!, {
      target: { value: "3" },
    });

    await waitFor(() =>
      expect(document.getElementById("reschedule-end-date")).toBeInTheDocument(),
    );

    fireEvent.change(document.getElementById("reschedule-end-date")!, {
      target: { value: "2030-06-12" },
    });

    fireEvent.change(document.getElementById("reschedule-duration-unit")!, {
      target: { value: "hours" },
    });
    fireEvent.change(document.getElementById("reschedule-duration-value")!, {
      target: { value: "4" },
    });

    await waitFor(() =>
      expect(document.getElementById("reschedule-end-date")).not.toBeInTheDocument(),
    );
  });

  it("toasts generic propose failure for non-Error throws", async () => {
    mutateAsync.mockRejectedValue("boom");

    render(
      <ProposeRescheduleDialog open onOpenChange={vi.fn()} rescheduleRequestId="req-1" />,
    );

    await waitFor(() =>
      expect(document.getElementById("reschedule-start-date")).toBeInTheDocument(),
    );

    fireEvent.change(document.getElementById("reschedule-start-date")!, {
      target: { value: "2030-06-10" },
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enviar proposta" })).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao propor nova data."),
    );
  });
});
