// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceContractedSection } from "../ServiceContractedSection";
import type { ContractedServiceSummary } from "../../types/service.types";

vi.mock("@/features/payments", () => ({
  PaymentDisputeStatus: () => <div data-testid="dispute" />,
  ProviderSettlementStatus: () => <div data-testid="settlement" />,
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
  it("renders contracted summary without action CTAs", () => {
    render(<ServiceContractedSection contracted={contracted} />);

    expect(screen.getByText("Serviço contratado")).toBeInTheDocument();
    expect(screen.getByText(/João/)).toBeInTheDocument();
    expect(screen.getByText(/Agendado para/)).toBeInTheDocument();
    expect(screen.queryByTestId("manual-payment")).not.toBeInTheDocument();
    expect(screen.queryByTestId("client-evaluate-service-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-action")).not.toBeInTheDocument();
  });

  it("shows provider settlement when requested", () => {
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
