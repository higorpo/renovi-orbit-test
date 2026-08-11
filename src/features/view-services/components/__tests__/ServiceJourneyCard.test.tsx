import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceJourneyCard } from "../ServiceJourneyCard";
import { ServiceJourneyCardSkeleton } from "../ServiceJourneyCardSkeleton";
import type { PresentedServiceJourneyMilestone } from "../../types/serviceJourney.types";

const milestones: PresentedServiceJourneyMilestone[] = [
  {
    key: "request_created",
    status: "completed",
    label: "Pedido criado",
    secondaryText: "Hoje, 10:00",
  },
  {
    key: "payment",
    status: "current",
    label: "Pagamento pendente",
    secondaryText: "Aguardando pagamento",
  },
  {
    key: "service_scheduled",
    status: "upcoming",
    label: "Serviço agendado",
    secondaryText: "Próximo passo",
  },
];

describe("ServiceJourneyCard", () => {
  it("renders milestone labels without section title", () => {
    render(<ServiceJourneyCard milestones={milestones} />);

    expect(screen.getByTestId("service-journey-card")).toBeInTheDocument();
    expect(screen.queryByText("Acompanhe seu pedido")).not.toBeInTheDocument();
    expect(screen.getByText("Pedido criado")).toBeInTheDocument();
    expect(screen.getByText("Pagamento pendente")).toBeInTheDocument();
    expect(screen.getByText("Aguardando pagamento")).toBeInTheDocument();
    expect(screen.getByTestId("service-journey-milestone-payment")).toHaveAttribute(
      "data-status",
      "current",
    );
  });

  it("renders nothing when milestones are empty", () => {
    const { container } = render(<ServiceJourneyCard milestones={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ServiceJourneyCardSkeleton", () => {
  it("renders busy skeleton with journey label", () => {
    render(<ServiceJourneyCardSkeleton />);
    expect(screen.getByTestId("service-journey-card-skeleton")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Carregando Acompanhe seu pedido"),
    ).toBeInTheDocument();
  });
});
