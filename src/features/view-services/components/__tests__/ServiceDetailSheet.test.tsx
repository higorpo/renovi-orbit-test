// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceDetailSheet } from "../ServiceDetailSheet";

const navigateMock = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../ServiceDetailPage", () => ({
  ServiceDetailPage: ({
    serviceRequestId,
    isInsideSheet,
  }: {
    serviceRequestId: string;
    isInsideSheet?: boolean;
  }) => (
    <div data-testid="detail-page">
      {serviceRequestId}:{String(isInsideSheet)}
    </div>
  ),
}));

describe("ServiceDetailSheet", () => {
  it("renders detail page inside the sheet", () => {
    render(<ServiceDetailSheet serviceRequestId="sr-9" />);
    expect(screen.getByText("Detalhes do serviço")).toBeInTheDocument();
    expect(screen.getByTestId("detail-page")).toHaveTextContent("sr-9:true");
  });

  it("navigates back when sheet is closed", () => {
    render(<ServiceDetailSheet serviceRequestId="sr-9" />);
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
