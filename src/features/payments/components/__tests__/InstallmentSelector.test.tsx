// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByText(/1x de/i)).toBeInTheDocument();
    expect(screen.getByText(/3x de/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Total com taxas/i)).toHaveLength(2);
  });

  it("calls onSelect with installment number and HMAC", async () => {
    const onSelect = vi.fn();
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
      />,
    );

    fireEvent.click(screen.getByRole("radio"));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

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
});
