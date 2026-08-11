import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientServiceJourneySection } from "../ClientServiceJourneySection";

const useClientServiceJourneyMock = vi.fn();

vi.mock("../../hooks/useClientServiceJourney", () => ({
  useClientServiceJourney: (...args: unknown[]) => useClientServiceJourneyMock(...args),
}));

describe("ClientServiceJourneySection", () => {
  beforeEach(() => {
    useClientServiceJourneyMock.mockReset();
  });

  it("renders skeleton while loading", () => {
    useClientServiceJourneyMock.mockReturnValue({
      milestones: [],
      isLoading: true,
      isError: false,
      isFetching: true,
    });

    render(<ClientServiceJourneySection serviceRequestId="sr-1" />);

    expect(screen.getByTestId("service-journey-card-skeleton")).toBeInTheDocument();
    expect(useClientServiceJourneyMock).toHaveBeenCalledWith({
      serviceRequestId: "sr-1",
      enabled: true,
      ratingOptional: false,
    });
  });

  it("renders the card when milestones are ready", () => {
    useClientServiceJourneyMock.mockReturnValue({
      milestones: [
        {
          key: "request_created",
          status: "completed",
          label: "Pedido criado",
          secondaryText: "Hoje, 10:00",
        },
      ],
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<ClientServiceJourneySection serviceRequestId="sr-1" ratingOptional />);

    expect(screen.getByTestId("service-journey-card")).toBeInTheDocument();
    expect(screen.getByText("Acompanhe seu pedido")).toBeInTheDocument();
    expect(screen.getByText("Pedido criado")).toBeInTheDocument();
    expect(useClientServiceJourneyMock).toHaveBeenCalledWith({
      serviceRequestId: "sr-1",
      enabled: true,
      ratingOptional: true,
    });
  });

  it("renders nothing when there are no milestones", () => {
    useClientServiceJourneyMock.mockReturnValue({
      milestones: [],
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    const { container } = render(
      <ClientServiceJourneySection serviceRequestId="sr-1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("disables the query when serviceRequestId is blank", () => {
    useClientServiceJourneyMock.mockReturnValue({
      milestones: [],
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<ClientServiceJourneySection serviceRequestId="  " />);

    expect(useClientServiceJourneyMock).toHaveBeenCalledWith({
      serviceRequestId: "  ",
      enabled: false,
      ratingOptional: false,
    });
  });
});
