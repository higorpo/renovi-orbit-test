import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceRequestSummaryBlock } from "../ServiceRequestSummaryBlock";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: () => ({
    color: "from-blue-600 to-blue-800",
    Icon: function MockIcon() {
      return <span data-testid="svc-icon" />;
    },
  }),
}));

vi.mock("@/lib/formatRelativeDate", () => ({
  formatRelativeDate: () => "hoje",
}));

describe("ServiceRequestSummaryBlock", () => {
  it("renders title, description and location", () => {
    render(
      <ServiceRequestSummaryBlock
        serviceTitle="Encanador"
        serviceRequestTitle="Vazamento"
        description="Banheiro social"
        iconKey="pipe"
        colorKey="blue"
        location="Centro, SP"
        createdAt="2024-06-01T12:00:00Z"
      />,
    );
    expect(screen.getByText("Encanador")).toBeInTheDocument();
    expect(screen.getByText("Vazamento")).toBeInTheDocument();
    expect(screen.getByText("Banheiro social")).toBeInTheDocument();
    expect(screen.getByText(/Centro, SP/)).toBeInTheDocument();
    expect(screen.getByText(/publicado hoje/i)).toBeInTheDocument();
    expect(screen.getByTestId("svc-icon")).toBeInTheDocument();
  });

  it("omits description and location when empty", () => {
    render(
      <ServiceRequestSummaryBlock
        serviceTitle="S"
        serviceRequestTitle="R"
        description={null}
        iconKey={null}
        colorKey={null}
        location=""
        createdAt="2024-06-01T12:00:00Z"
      />,
    );
    expect(screen.queryByText(/Centro/)).not.toBeInTheDocument();
  });
});
