import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ProviderBudgetsPersistentSlot } from "../ProviderBudgetsPersistentSlot";

vi.mock("../ProviderBudgetsPage", () => ({
  ProviderBudgetsPage: () => <div data-testid="budgets-page" />,
}));

describe("ProviderBudgetsPersistentSlot", () => {
  it("renders budgets page on /dashboard/budgets", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/budgets"]}>
        <Routes>
          <Route path="/dashboard/budgets" element={<ProviderBudgetsPersistentSlot />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("budgets-page")).toBeInTheDocument();
  });

  it("keeps budgets page mounted when service detail sheet is open from budgets", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/dashboard/services/sr-1",
            state: {
              serviceDetailPresentation: "sheet",
              returnTo: "/dashboard/budgets",
              background: { pathname: "/dashboard/budgets", search: "", hash: "", key: "bg" },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/dashboard/services/:id" element={<ProviderBudgetsPersistentSlot />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("budgets-page")).toBeInTheDocument();
  });
});
