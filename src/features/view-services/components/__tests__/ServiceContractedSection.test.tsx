// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceContractedSection } from "../ServiceContractedSection";
import type { ContractedServiceSummary } from "../../types/service.types";

const authMocks = vi.hoisted(() => ({
  profile: { role: "client" as "client" | "provider" },
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("@/features/payments", () => ({
  PaymentDisputeStatus: () => <div data-testid="dispute" />,
  ProviderSettlementStatus: () => <div data-testid="settlement" />,
  ManualPaymentRecovery: () => <div data-testid="manual-payment" />,
  ContractedServiceCancelAction: () => <div data-testid="cancel-action" />,
}));

vi.mock("@/features/service-reschedule", () => ({
  ContractedServiceRescheduleAction: () => <div data-testid="reschedule-action" />,
}));

vi.mock("../ServiceCompletionActions", () => ({
  ServiceCompletionActions: () => <div data-testid="completion-actions" />,
}));

const contracted: ContractedServiceSummary = {
  id: "cs-1",
  status: "CONFIRMED",
  agreedSlot: null,
  durationUnit: "hours",
  durationValue: 2,
  scheduledStartDate: "2026-06-10",
  scheduledEndDate: null,
  scheduledShift: "morning",
  provider: { id: "p-1", displayName: "João", profileImagePath: null },
  chatId: "chat-1",
  updatedAt: null,
};

describe("ServiceContractedSection", () => {
  it("renders contracted summary and optional actions for clients", () => {
    authMocks.profile = { role: "client" };
    render(
      <ServiceContractedSection
        contracted={contracted}
        serviceRequestId="sr-1"
        showManualPayment
        showServiceCompletion
        completionViewerRole="client"
        showServiceCancellation
        cancellationViewerRole="client"
      />,
    );

    expect(screen.getByText("Serviço contratado")).toBeInTheDocument();
    expect(screen.getByText(/João/)).toBeInTheDocument();
    expect(screen.getByText(/Agendado para/)).toBeInTheDocument();
    expect(screen.getByTestId("manual-payment")).toBeInTheDocument();
    expect(screen.getByTestId("completion-actions")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-action")).toBeInTheDocument();
    expect(screen.getByTestId("reschedule-action")).toBeInTheDocument();
  });

  it("shows provider settlement when requested", () => {
    authMocks.profile = { role: "provider" };
    render(
      <ServiceContractedSection
        contracted={{ ...contracted, provider: null, scheduledStartDate: "" }}
        showProviderSettlement
      />,
    );

    expect(screen.getByTestId("settlement")).toBeInTheDocument();
    expect(screen.queryByText(/Profissional:/)).not.toBeInTheDocument();
  });

  it("shows far-recapture pending notice when flag is set", () => {
    authMocks.profile = { role: "client" };
    render(
      <ServiceContractedSection
        contracted={{ ...contracted, farRecapturePending: true }}
      />,
    );

    expect(screen.getByTestId("far-recapture-pending-notice")).toHaveTextContent(
      /reajustando a cobrança/i,
    );
  });
});
