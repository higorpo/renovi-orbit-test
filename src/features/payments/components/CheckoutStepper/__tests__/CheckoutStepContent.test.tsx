import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CheckoutStepContent } from "../CheckoutStepContent";
import type { CheckoutStepperRenderProps } from "../CheckoutStepper";
import type { CheckoutContext } from "../../../types/checkoutStepper.types";

vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    profile: { phone: "48999999999" },
  }),
}));

vi.mock("../../../hooks/useClientCpfForPayment", () => ({
  useClientCpfForPayment: () => ({ cpf: "39053344705", isLoading: false, error: null }),
}));

vi.mock("../CpfStep", () => ({
  CpfStep: () => <div data-testid="cpf-step">CPF</div>,
}));

vi.mock("../PhoneStep", () => ({
  PhoneStep: () => <div data-testid="phone-step">Phone</div>,
}));

vi.mock("../CardStep", () => ({
  CardStep: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-step">{children}</div>
  ),
}));

vi.mock("../SavedCardSelector", () => ({
  SavedCardSelector: ({
    onSelect,
  }: {
    onSelect: (selection: { paymentTokenId: string; cardBrand: string }) => void;
  }) => (
    <button
      type="button"
      data-testid="saved-card-selector"
      onClick={() => onSelect({ paymentTokenId: "token-1", cardBrand: "VISA" })}
    >
      Saved cards
    </button>
  ),
}));

vi.mock("../../InstallmentSelector", () => ({
  InstallmentSelector: ({
    onSelect,
  }: {
    onSelect: (selection: {
      installmentNumber: number;
      installmentSelectionHmac: string;
      installmentHmacPayload: Record<string, unknown>;
      installmentAmount: number;
      totalWithFees: number;
      installmentOptions: unknown[];
      computedAt: string;
      expiresAt: string;
    }) => void;
  }) => (
    <button
      type="button"
      data-testid="installment-selector"
      onClick={() =>
        onSelect({
          installmentNumber: 1,
          installmentSelectionHmac: "hmac-1",
          installmentHmacPayload: {
            proposal_id: "proposal-1",
            service_id: "service-1",
            base_amount: 100,
            card_brand: "VISA",
            installment_options: [],
            computed_at: "2026-07-01T00:00:00.000Z",
            expires_at: "2026-07-01T01:00:00.000Z",
          },
          installmentAmount: 100,
          totalWithFees: 100,
          installmentOptions: [],
          computedAt: "2026-07-01T00:00:00.000Z",
          expiresAt: "2026-07-01T01:00:00.000Z",
        })
      }
    >
      Installments
    </button>
  ),
}));

vi.mock("../ConfirmationStep", () => ({
  ConfirmationStep: ({
    onSuccess,
    onInstallmentSignatureExpired,
  }: {
    onSuccess: (id: string) => void;
    onInstallmentSignatureExpired: () => void;
  }) => (
    <div data-testid="confirmation-step">
      <button type="button" onClick={() => onSuccess("service-1")}>
        Success
      </button>
      <button type="button" onClick={() => onInstallmentSignatureExpired()}>
        Expired
      </button>
    </div>
  ),
}));

function makeStepper(
  overrides: Partial<CheckoutStepperRenderProps> = {},
): CheckoutStepperRenderProps {
  return {
    currentStep: "cpf",
    steps: ["cpf", "phone", "card", "installments", "confirmation"],
    stepData: {},
    completeStep: vi.fn(),
    goBack: vi.fn(),
    goToStep: vi.fn(),
    canGoBack: false,
    setClearsaleSessionId: vi.fn(),
    clearsaleSessionId: "session-1",
    isLoadingRequirements: false,
    requirementsError: null,
    ...overrides,
  } as CheckoutStepperRenderProps;
}

const checkoutContext: CheckoutContext = {
  serviceTitle: "Pintura",
  scheduledDate: "2026-07-20",
  baseAmount: 100,
  selectedSlot: {
    date: "2026-07-20",
    shift: "MORNING",
  } as CheckoutContext["selectedSlot"],
  pricingSignature: "sig-1",
};

describe("CheckoutStepContent", () => {
  it("renders CPF and phone steps", () => {
    const { rerender } = render(
      <CheckoutStepContent stepper={makeStepper({ currentStep: "cpf" })} />,
    );
    expect(screen.getByTestId("cpf-step")).toBeInTheDocument();

    rerender(
      <CheckoutStepContent stepper={makeStepper({ currentStep: "phone" })} />,
    );
    expect(screen.getByTestId("phone-step")).toBeInTheDocument();
  });

  it("renders saved card selector when proposalId is present", () => {
    render(
      <CheckoutStepContent
        stepper={makeStepper({ currentStep: "card" })}
        proposalId="proposal-1"
      />,
    );

    expect(screen.getByTestId("card-step")).toBeInTheDocument();
    expect(screen.getByTestId("saved-card-selector")).toBeInTheDocument();
  });

  it("wires child callbacks for card, installments and confirmation", () => {
    const completeStep = vi.fn();
    const goToStep = vi.fn();
    const onCheckoutSuccess = vi.fn();

    const { rerender } = render(
      <CheckoutStepContent
        stepper={makeStepper({
          currentStep: "card",
          completeStep,
          canGoBack: true,
        })}
        proposalId="proposal-1"
      />,
    );

    fireEvent.click(screen.getByTestId("saved-card-selector"));
    expect(completeStep).toHaveBeenCalledWith({
      cardTokenId: "token-1",
      cardBrand: "VISA",
    });

    rerender(
      <CheckoutStepContent
        stepper={makeStepper({
          currentStep: "installments",
          completeStep,
          stepData: {
            cardBrand: "VISA",
            cardTokenId: "token-1",
          },
        })}
        proposalId="proposal-1"
        serviceId="service-1"
      />,
    );
    fireEvent.click(screen.getByTestId("installment-selector"));
    expect(completeStep).toHaveBeenCalledWith(
      expect.objectContaining({
        installmentNumber: 1,
        hmac: "hmac-1",
      }),
    );

    rerender(
      <CheckoutStepContent
        stepper={makeStepper({
          currentStep: "confirmation",
          goToStep,
          stepData: {
            cardTokenId: "token-1",
            installmentNumber: 1,
            hmac: "hmac-1",
            installmentHmacPayload: {
              proposal_id: "proposal-1",
              service_id: "service-1",
              base_amount: 100,
              card_brand: "VISA",
              installment_options: [],
              computed_at: "2026-07-01T00:00:00.000Z",
              expires_at: "2026-07-01T01:00:00.000Z",
            },
            installmentAmount: 100,
            totalWithFees: 100,
          },
        })}
        proposalId="proposal-1"
        serviceId="service-1"
        checkoutContext={checkoutContext}
        onCheckoutSuccess={onCheckoutSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Success" }));
    expect(onCheckoutSuccess).toHaveBeenCalledWith("service-1");
    fireEvent.click(screen.getByRole("button", { name: "Expired" }));
    expect(goToStep).toHaveBeenCalledWith("installments");
  });

  it("renders card placeholder without proposalId", () => {
    render(
      <CheckoutStepContent stepper={makeStepper({ currentStep: "card" })} />,
    );

    expect(screen.getByTestId("checkout-step-card")).toBeInTheDocument();
  });

  it("renders installment selector when card data is present", () => {
    render(
      <CheckoutStepContent
        stepper={makeStepper({
          currentStep: "installments",
          stepData: {
            cardBrand: "VISA",
            cardTokenId: "token-1",
          },
        })}
        proposalId="proposal-1"
        serviceId="service-1"
      />,
    );

    expect(screen.getByTestId("installment-selector")).toBeInTheDocument();
  });

  it("renders installment placeholder when card data is missing", () => {
    render(
      <CheckoutStepContent
        stepper={makeStepper({ currentStep: "installments" })}
        proposalId="proposal-1"
        serviceId="service-1"
      />,
    );

    expect(screen.getByTestId("checkout-step-installments")).toBeInTheDocument();
  });

  it("renders confirmation step when all required data is present", () => {
    render(
      <CheckoutStepContent
        stepper={makeStepper({
          currentStep: "confirmation",
          stepData: {
            cardTokenId: "token-1",
            installmentNumber: 1,
            hmac: "hmac-1",
            installmentHmacPayload: {
              proposal_id: "proposal-1",
              service_id: "service-1",
              base_amount: 100,
              card_brand: "VISA",
              installment_options: [],
              computed_at: "2026-07-01T00:00:00.000Z",
              expires_at: "2026-07-01T01:00:00.000Z",
            },
            installmentAmount: 100,
            totalWithFees: 100,
          },
        })}
        proposalId="proposal-1"
        serviceId="service-1"
        checkoutContext={checkoutContext}
      />,
    );

    expect(screen.getByTestId("confirmation-step")).toBeInTheDocument();
  });

  it("renders confirmation placeholder when context is incomplete", () => {
    render(
      <CheckoutStepContent
        stepper={makeStepper({ currentStep: "confirmation" })}
        proposalId="proposal-1"
      />,
    );

    expect(screen.getByTestId("checkout-step-confirmation")).toBeInTheDocument();
  });
});
