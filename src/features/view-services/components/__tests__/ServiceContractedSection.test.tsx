// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ServiceContractedSection } from "../ServiceContractedSection";
import type { ContractedServiceSummary } from "../../types/service.types";

vi.mock("@/features/payments", () => ({
  PaymentDisputeStatus: () => <div data-testid="dispute" />,
}));

vi.mock("@/features/provider-profile", () => ({
  getProviderProfilePath: (slug: string) => `/perfil/${slug}`,
  usePublicProfileImageUrl: () => ({ url: "", isLoading: false }),
}));

vi.mock("../../hooks/useProviderRatingSummary", () => ({
  useProviderRatingSummary: () => ({
    data: { providerId: "p-1", ratingAvg: 4.9, ratingCount: 128 },
    isLoading: false,
  }),
}));

const contracted: ContractedServiceSummary = {
  id: "cs-1",
  status: "PENDING_PAYMENT",
  agreedSlot: null,
  durationUnit: "hours",
  durationValue: 2,
  scheduledStartDate: "2026-06-16",
  scheduledEndDate: null,
  scheduledShift: "full_day",
  provider: {
    id: "p-1",
    displayName: "Pedro Eletricista",
    profileImagePath: null,
    slug: "pedro-eletricista",
  },
  chatId: "chat-1",
  updatedAt: null,
  serviceAmount: 680,
};

function renderSection(
  props: Partial<ComponentProps<typeof ServiceContractedSection>> = {},
) {
  return render(
    <MemoryRouter>
      <ServiceContractedSection
        contracted={contracted}
        viewerRole="client"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("ServiceContractedSection", () => {
  it("renders rich client layout with provider, schedule, status, amount and profile CTA", () => {
    renderSection();

    expect(screen.getByText("Serviço contratado")).toBeInTheDocument();
    expect(screen.getByTestId("contracted-provider-header")).toBeInTheDocument();
    expect(screen.getByText("Pedro Eletricista")).toBeInTheDocument();
    expect(screen.getByText("4,9")).toBeInTheDocument();
    expect(screen.getByText(/128 avaliações/)).toBeInTheDocument();
    expect(screen.getByText("Data agendada")).toBeInTheDocument();
    expect(screen.getByText(/16\/06\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/dia inteiro/)).toBeInTheDocument();
    expect(screen.getByText("Aguardando pagamento")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*680,00/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver perfil do profissional" }),
    ).toHaveAttribute("href", "/perfil/pedro-eletricista");
    expect(screen.getByTestId("dispute")).toBeInTheDocument();
  });

  it("hides provider reputation and profile CTA for provider viewers", () => {
    renderSection({ viewerRole: "provider" });

    expect(screen.queryByTestId("contracted-provider-header")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ver perfil do profissional" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Aguardando pagamento")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*680,00/)).toBeInTheDocument();
  });

  it("shows far-recapture pending notice when flag is set", () => {
    renderSection({
      contracted: { ...contracted, farRecapturePending: true },
    });

    expect(screen.getByTestId("far-recapture-pending-notice")).toHaveTextContent(
      /reajustando a cobrança/i,
    );
  });
});
