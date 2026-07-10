// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { InstallmentSelector } from "../InstallmentSelector";

const mockUseInstallmentOptions = vi.fn();

vi.mock("../../hooks/useInstallmentOptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/useInstallmentOptions")>();
  return {
    ...actual,
    useInstallmentOptions: (...args: unknown[]) => mockUseInstallmentOptions(...args),
  };
});

describe("InstallmentSelector", () => {
  const installmentHmacPayload = {
    proposal_id: "proposal-1",
    service_id: "service-1",
    base_amount: 1000,
    card_brand: "VISA",
    installment_options: [],
    computed_at: "2030-01-01T00:00:00Z",
    expires_at: "2030-01-01T00:00:00Z",
  };

  beforeEach(() => {
    mockUseInstallmentOptions.mockReset();
  });

  it("renders installment options with fee-inclusive totals", () => {
    mockUseInstallmentOptions.mockReturnValue({
      data: {
        installment_options: [
          {
            installment_number: 1,
            applicable_rate_pct: 2.5,
            total_with_fees: 1000,
            installment_amount: 1000,
          },
          {
            installment_number: 3,
            applicable_rate_pct: 4,
            total_with_fees: 1050,
            installment_amount: 350,
          },
        ],
        installment_selection_hmac: "hmac-123",
        installment_hmac_payload: installmentHmacPayload,
        expires_at: "2030-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <InstallmentSelector
        proposalId="proposal-1"
        serviceId="service-1"
        cardBrand="VISA"
        paymentTokenId="token-1"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText(/Escolha o parcelamento/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /1x de/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /3x de/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Total com taxas/i)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Continuar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Voltar/i })).toBeNull();
  });

  it("shows loading and error states", () => {
    mockUseInstallmentOptions.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    const { rerender } = render(
      <InstallmentSelector
        proposalId="proposal-1"
        serviceId="service-1"
        cardBrand="VISA"
        paymentTokenId="token-1"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("installment-selector-skeleton")).toBeInTheDocument();
    expect(screen.getByLabelText(/Calculando parcelas/i)).toBeInTheDocument();

    const refetch = vi.fn();
    mockUseInstallmentOptions.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("parcelas indisponíveis"),
      refetch,
    });
    rerender(
      <InstallmentSelector
        proposalId="proposal-1"
        serviceId="service-1"
        cardBrand="VISA"
        paymentTokenId="token-1"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Não foi possível carregar as parcelas")).toBeInTheDocument();
    expect(screen.getByText("parcelas indisponíveis")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("calls onSelect via continueRef with installment number and HMAC", async () => {
    const onSelect = vi.fn();
    const continueRef: MutableRefObject<(() => void) | null> = { current: null };
    const onCanContinueChange = vi.fn();
    mockUseInstallmentOptions.mockReturnValue({
      data: {
        installment_options: [
          {
            installment_number: 3,
            applicable_rate_pct: 4,
            total_with_fees: 1050,
            installment_amount: 350,
          },
        ],
        installment_selection_hmac: "hmac-456",
        installment_hmac_payload: installmentHmacPayload,
        expires_at: "2030-01-01T00:00:00Z",
        computed_at: "2030-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <InstallmentSelector
        proposalId="proposal-1"
        serviceId="service-1"
        cardBrand="VISA"
        paymentTokenId="token-1"
        onSelect={onSelect}
        continueRef={continueRef}
        onCanContinueChange={onCanContinueChange}
      />,
    );

    await waitFor(() => {
      expect(onCanContinueChange).toHaveBeenCalledWith(false);
    });

    fireEvent.click(screen.getByRole("radio"));

    await waitFor(() => {
      expect(onCanContinueChange).toHaveBeenCalledWith(true);
    });

    continueRef.current?.();

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith({
        installmentNumber: 3,
        installmentSelectionHmac: "hmac-456",
        installmentHmacPayload,
        installmentAmount: 350,
        totalWithFees: 1050,
        installmentOptions: [
          {
            installment_number: 3,
            applicable_rate_pct: 4,
            total_with_fees: 1050,
            installment_amount: 350,
          },
        ],
        computedAt: "2030-01-01T00:00:00Z",
        expiresAt: "2030-01-01T00:00:00Z",
      });
    });
  });

  it("does not call onSelect when hmac payload is missing", () => {
    const onSelect = vi.fn();
    const continueRef: MutableRefObject<(() => void) | null> = { current: null };
    mockUseInstallmentOptions.mockReturnValue({
      data: {
        installment_options: [
          {
            installment_number: 1,
            applicable_rate_pct: 0,
            total_with_fees: 100,
            installment_amount: 100,
          },
        ],
        installment_selection_hmac: undefined,
        installment_hmac_payload: undefined,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <InstallmentSelector
        proposalId="proposal-1"
        serviceId="service-1"
        cardBrand="VISA"
        paymentTokenId="token-1"
        onSelect={onSelect}
        continueRef={continueRef}
      />,
    );

    fireEvent.click(screen.getByRole("radio"));
    continueRef.current?.();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("triggers signature recovery helper", async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mockUseInstallmentOptions.mockReturnValue({
      data: {
        installment_options: [
          {
            installment_number: 1,
            applicable_rate_pct: 0,
            total_with_fees: 100,
            installment_amount: 100,
          },
        ],
        installment_selection_hmac: "hmac",
        installment_hmac_payload: installmentHmacPayload,
        expires_at: "2030-01-01T00:00:00Z",
      },
      isLoading: false,
      isError: false,
      refetch,
    });

    render(
      <InstallmentSelector
        proposalId="proposal-1"
        serviceId="service-1"
        cardBrand="VISA"
        paymentTokenId="token-1"
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("installment-signature-recovery-trigger"));
    await waitFor(() => {
      expect(refetch).toHaveBeenCalled();
    });
  });
});
