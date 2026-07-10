import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ContractedServiceCancelAction } from "../ContractedServiceCancelAction";

const mockUsePaymentScheduleLifecycle = vi.fn();
const mockMutateAsync = vi.fn();
const mockOnSuccess = vi.fn();
const processRefundIsPending = { current: false };

vi.mock("../../hooks/usePaymentScheduleLifecycle", () => ({
  usePaymentScheduleLifecycle: (...args: unknown[]) => mockUsePaymentScheduleLifecycle(...args),
}));

vi.mock("../../hooks/useProcessRefund", () => ({
  useProcessRefund: () => ({
    mutateAsync: mockMutateAsync,
    get isPending() {
      return processRefundIsPending.current;
    },
  }),
}));

const mockCanCancel = vi.fn(() => true);

vi.mock("../../utils/contractedServiceCancellation", () => ({
  canCancelContractedService: (...args: unknown[]) => mockCanCancel(...args),
  getCancellationDisclosure: vi.fn(() => ({
    title: "Cancelar serviço?",
    description: "Confirma o cancelamento?",
    confirmLabel: "Confirmar cancelamento",
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ContractedServiceCancelAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processRefundIsPending.current = false;
    mockCanCancel.mockReturnValue(true);
    mockUsePaymentScheduleLifecycle.mockReturnValue({
      isLoading: false,
      data: {
        contractedServiceId: "service-1",
        state: "AUTHORIZED",
        chargeScheduledAt: null,
        baseAmount: null,
        paidAmount: null,
      },
    });
  });

  it("returns null when not eligible", () => {
    mockCanCancel.mockReturnValue(false);

    const { container } = render(
      <ContractedServiceCancelAction
        contractedServiceId="service-1"
        serviceStatus="CANCELLED"
        scheduledStartDate="2026-07-20"
        scheduledShift="MORNING"
        viewerRole="client"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("uses fallback disclosure when schedule data is missing", async () => {
    mockUsePaymentScheduleLifecycle.mockReturnValue({
      isLoading: false,
      data: undefined,
    });

    render(
      <ContractedServiceCancelAction
        contractedServiceId="service-1"
        serviceStatus="CONFIRMED"
        scheduledStartDate="2026-07-20"
        scheduledShift="MORNING"
        viewerRole="client"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancelar serviço/i }));
    expect(screen.getByText(/Esta ação não pode ser desfeita/i)).toBeInTheDocument();
  });

  it("returns null while loading", () => {
    mockUsePaymentScheduleLifecycle.mockReturnValue({
      isLoading: true,
      data: undefined,
    });

    const { container } = render(
      <ContractedServiceCancelAction
        contractedServiceId="service-1"
        serviceStatus="CONFIRMED"
        scheduledStartDate="2026-07-20"
        scheduledShift="MORNING"
        viewerRole="client"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("opens dialog and cancels with success toast", async () => {
    mockMutateAsync.mockResolvedValue({
      scheduleId: "sched-1",
      outcome: "PRE_CHARGE_CANCELLED",
    });

    render(
      <ContractedServiceCancelAction
        contractedServiceId="service-1"
        serviceStatus="CONFIRMED"
        scheduledStartDate="2026-07-20"
        scheduledShift="MORNING"
        viewerRole="client"
        onSuccess={mockOnSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancelar serviço/i }));
    expect(screen.getByText("Cancelar serviço?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar cancelamento/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        contractedServiceId: "service-1",
        cancellationReason: "CLIENT_INITIATED",
      });
    });

    expect(toast.success).toHaveBeenCalledWith("Serviço cancelado com sucesso.");
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it("uses provider cancellation reason and refund toast", async () => {
    mockMutateAsync.mockResolvedValue({
      scheduleId: "sched-1",
      outcome: "REFUND_SUBMITTED",
    });

    render(
      <ContractedServiceCancelAction
        contractedServiceId="service-1"
        serviceStatus="CONFIRMED"
        scheduledStartDate="2026-07-20"
        scheduledShift="MORNING"
        viewerRole="provider"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancelar serviço/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar cancelamento/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        contractedServiceId: "service-1",
        cancellationReason: "PROVIDER_INITIATED",
      });
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Cancelamento solicitado. O estorno será processado em breve.",
    );
  });

  it("shows error toast when cancel fails", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Falha ao cancelar"));

    render(
      <ContractedServiceCancelAction
        contractedServiceId="service-1"
        serviceStatus="CONFIRMED"
        scheduledStartDate="2026-07-20"
        scheduledShift="MORNING"
        viewerRole="client"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancelar serviço/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar cancelamento/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Falha ao cancelar");
    });
  });

  it("shows Cancelando… spinner while refund is pending", async () => {
    mockMutateAsync.mockImplementation(() => new Promise(() => {}));

    const props = {
      contractedServiceId: "service-1",
      serviceStatus: "CONFIRMED",
      scheduledStartDate: "2026-07-20",
      scheduledShift: "MORNING",
      viewerRole: "client" as const,
    };

    const { rerender } = render(<ContractedServiceCancelAction {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Cancelar serviço/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar cancelamento/i }));

    processRefundIsPending.current = true;
    rerender(<ContractedServiceCancelAction {...props} />);

    expect(screen.getByRole("button", { name: /Cancelando…/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Voltar$/i })).toBeDisabled();
  });

  it("shows generic error toast when cancel throws a non-Error value", async () => {
    mockMutateAsync.mockRejectedValue("network down");

    render(
      <ContractedServiceCancelAction
        contractedServiceId="service-1"
        serviceStatus="CONFIRMED"
        scheduledStartDate="2026-07-20"
        scheduledShift="MORNING"
        viewerRole="client"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cancelar serviço/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar cancelamento/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Falha ao cancelar serviço.");
    });
  });
});
