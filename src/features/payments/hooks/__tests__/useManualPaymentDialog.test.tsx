// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentScheduleSummary } from "../../types/paymentSchedule.types";
import type { InstallmentSelection } from "../../types/paymentToken.types";
import { useManualPaymentDialog } from "../useManualPaymentDialog";

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockUpdatePaymentMethod = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseAuth = vi.fn();
const mockUseClientCpfForPayment = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../api/cards.api", () => ({
  updatePaymentMethod: (...args: unknown[]) => mockUpdatePaymentMethod(...args),
}));

vi.mock("../useManualChargePayment", () => ({
  useManualChargePayment: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("../useClientCpfForPayment", () => ({
  useClientCpfForPayment: () => mockUseClientCpfForPayment(),
}));

const schedule: PaymentScheduleSummary = {
  id: "sched-1",
  contractedServiceId: "service-1",
  state: "FAILED",
  paymentTokenId: "token-old",
  installmentNumber: 1,
  baseAmount: 100,
  failureReason: "Cartão recusado",
  failureCode: "CARD_DECLINED",
  isDisputed: false,
  paidAt: null,
};

const installment: InstallmentSelection = {
  installmentNumber: 2,
  installmentSelectionHmac: "hmac",
  installmentHmacPayload: {
    proposal_id: "proposal-1",
    service_id: "sr-1",
    base_amount: 150,
    card_brand: "VISA",
    installment_options: [],
    computed_at: "2030-01-01T00:00:00.000Z",
    expires_at: "2030-01-01T00:00:00.000Z",
  },
  installmentAmount: 52.5,
  totalWithFees: 105,
  installmentOptions: [],
  computedAt: "2030-01-01T00:00:00.000Z",
  expiresAt: "2030-01-01T00:00:00.000Z",
};

describe("useManualPaymentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      profile: { phone: "48999999999" },
    });
    mockUseClientCpfForPayment.mockReturnValue({
      cpf: "390.533.447-05",
    });
    mockUpdatePaymentMethod.mockResolvedValue({ data: { ok: true }, error: null });
    mockMutateAsync.mockResolvedValue({ outcome: "PAID" });
  });

  it("exposes saved CPF and phone from profile", () => {
    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange: vi.fn(),
      }),
    );

    expect(result.current.savedCpf).toBe("390.533.447-05");
    expect(result.current.savedPhone).toBe("48999999999");
  });

  it("advances from card selection to installments then confirm", () => {
    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
        cardNumberMasked: "•••• 1111",
        expiryMonth: 12,
        expiryYear: 2030,
      });
    });

    expect(result.current.view).toBe("installments");
    expect(result.current.selection?.paymentTokenId).toBe("token-1");

    act(() => {
      result.current.handleInstallmentSelected(installment);
    });

    expect(result.current.view).toBe("confirm");
    expect(result.current.selection?.installment).toEqual(installment);
  });

  it("keeps selection null when installment is chosen without a card", () => {
    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleInstallmentSelected(installment);
    });

    expect(result.current.selection).toBeNull();
    expect(result.current.view).toBe("confirm");
  });

  it("blocks confirm without installment or ClearSale session", async () => {
    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleConfirmPayment();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Selecione o cartão e as parcelas antes de continuar.",
    );
    expect(mockUpdatePaymentMethod).not.toHaveBeenCalled();

    act(() => {
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
        cardNumberMasked: null,
        expiryMonth: null,
        expiryYear: null,
      });
      result.current.handleInstallmentSelected(installment);
    });

    await act(async () => {
      await result.current.handleConfirmPayment();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Aguarde a inicialização da verificação de segurança.",
    );
    expect(mockUpdatePaymentMethod).not.toHaveBeenCalled();
  });

  it("updates method, charges, and closes on PAID", async () => {
    const onOpenChange = vi.fn();
    const onCompleted = vi.fn();
    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange,
        onCompleted,
      }),
    );

    act(() => {
      result.current.setClearsaleSessionId("session-1");
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
        cardNumberMasked: "•••• 1111",
        expiryMonth: 12,
        expiryYear: 2030,
      });
      result.current.handleInstallmentSelected(installment);
    });

    await act(async () => {
      await result.current.handleConfirmPayment();
    });

    expect(mockUpdatePaymentMethod).toHaveBeenCalledWith({
      contractedServiceId: "service-1",
      newPaymentTokenId: "token-1",
      installmentNumber: 2,
      installmentSelectionHmac: "hmac",
      installmentHmacPayload: installment.installmentHmacPayload,
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({
      scheduleId: "sched-1",
      clearsaleSessionId: "session-1",
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Pagamento realizado com sucesso!");
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows analysis toast on IN_ANALYSIS outcome", async () => {
    mockMutateAsync.mockResolvedValue({ outcome: "IN_ANALYSIS" });
    const onOpenChange = vi.fn();
    const onCompleted = vi.fn();
    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange,
        onCompleted,
      }),
    );

    act(() => {
      result.current.setClearsaleSessionId("session-1");
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
      });
      result.current.handleInstallmentSelected(installment);
    });

    await act(async () => {
      await result.current.handleConfirmPayment();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Pagamento em análise. Você será notificado em breve.",
    );
    expect(onCompleted).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("returns to installments when installment signature is invalid", async () => {
    mockUpdatePaymentMethod.mockResolvedValue({
      data: null,
      error: "Assinatura inválida",
      errorCode: "INVALID_INSTALLMENT_SIGNATURE",
    });

    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange: vi.fn(),
      }),
    );

    act(() => {
      result.current.setClearsaleSessionId("session-1");
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
      });
      result.current.handleInstallmentSelected(installment);
    });

    await act(async () => {
      await result.current.handleConfirmPayment();
    });

    expect(result.current.view).toBe("installments");
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
  });

  it("shows terminal error view for terminal charge outcomes", async () => {
    mockMutateAsync.mockResolvedValue({ outcome: "FAILED_PERMANENT" });

    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange: vi.fn(),
      }),
    );

    act(() => {
      result.current.setClearsaleSessionId("session-1");
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
      });
      result.current.handleInstallmentSelected(installment);
    });

    await act(async () => {
      await result.current.handleConfirmPayment();
    });

    expect(result.current.view).toBe("terminal-error");
    expect(result.current.terminalErrorMessage).toBeTruthy();
  });

  it("shows service-cancelled view when charge reports auto-cancel", async () => {
    const error = new Error("Serviço cancelado") as Error & { errorCode?: string };
    error.errorCode = "SERVICE_AUTO_CANCELLED";
    mockMutateAsync.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange: vi.fn(),
      }),
    );

    act(() => {
      result.current.setClearsaleSessionId("session-1");
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
      });
      result.current.handleInstallmentSelected(installment);
    });

    await act(async () => {
      await result.current.handleConfirmPayment();
    });

    expect(result.current.view).toBe("service-cancelled");
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("toasts mapped errors for non-cancel charge failures", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Timeout do gateway"));

    const { result } = renderHook(() =>
      useManualPaymentDialog({
        open: true,
        schedule,
        onOpenChange: vi.fn(),
      }),
    );

    act(() => {
      result.current.setClearsaleSessionId("session-1");
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
      });
      result.current.handleInstallmentSelected(installment);
    });

    await act(async () => {
      await result.current.handleConfirmPayment();
    });

    expect(mockToastError).toHaveBeenCalled();
    expect(result.current.view).toBe("confirm");
  });

  it("resets dialog state when closed", () => {
    const { result, rerender } = renderHook(
      ({ open }) =>
        useManualPaymentDialog({
          open,
          schedule,
          onOpenChange: vi.fn(),
        }),
      { initialProps: { open: true } },
    );

    act(() => {
      result.current.setClearsaleSessionId("session-1");
      result.current.handleCardSelected({
        paymentTokenId: "token-1",
        cardBrand: "VISA",
      });
    });

    expect(result.current.view).toBe("installments");

    rerender({ open: false });

    expect(result.current.view).toBe("card");
    expect(result.current.selection).toBeNull();
    expect(result.current.clearsaleSessionId).toBeNull();
    expect(result.current.terminalErrorMessage).toBeNull();
  });
});
