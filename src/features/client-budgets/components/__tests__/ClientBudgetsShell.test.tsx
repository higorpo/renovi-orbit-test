import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { ClientBudgetsShell, ClientBudgetsRouteSlot } from "../ClientBudgetsShell";

vi.mock("../ClientBudgetsPage", () => ({
  ClientBudgetsPage: () => <div data-testid="client-budgets-page">Page</div>,
}));

describe("ClientBudgetsShell", () => {
  it("renders ClientBudgetsPage and outlet children", () => {
    render(
      <MemoryRouter initialEntries={["/orcamentos/child"]}>
        <Routes>
          <Route path="/orcamentos" element={<ClientBudgetsShell />}>
            <Route path="child" element={<span data-testid="outlet-child">Child</span>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("client-budgets-page")).toBeInTheDocument();
    expect(screen.getByTestId("outlet-child")).toHaveTextContent("Child");
  });
});

describe("ClientBudgetsRouteSlot", () => {
  it("renders nothing", () => {
    const { container } = render(<ClientBudgetsRouteSlot />);
    expect(container.firstChild).toBeNull();
  });
});
