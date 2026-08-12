import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderEarningsSectionPage } from "../ProviderEarningsSectionPage";

const mocks = vi.hoisted(() => ({
  summary: {
    agreedTotal: 1000,
    netTotal: 1000,
    hasClawback: false,
    depositCount: 2,
    isLoadingReceivables: false,
    isLoadingDeposits: false,
    isErrorReceivables: false,
    isErrorDeposits: false,
  },
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    profile: { role: "provider" },
    loading: false,
  }),
}));

vi.mock("@/features/payments", () => ({
  PaymentHistorySection: () => <div>Lista de cobranças</div>,
}));

vi.mock("@/features/provider-earnings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/provider-earnings")>();
  return {
    ...actual,
    EarningsPage: () => <div>Lista de depósitos</div>,
  };
});

vi.mock("../../../hooks/useEarningsLedgerSummary", () => ({
  useEarningsLedgerSummary: () => mocks.summary,
}));

function renderPage(entry = "/dashboard/settings/earnings") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ProviderEarningsSectionPage />
    </MemoryRouter>,
  );
}

describe("ProviderEarningsSectionPage", () => {
  beforeEach(() => {
    mocks.summary.hasClawback = false;
    mocks.summary.agreedTotal = 1000;
    mocks.summary.depositCount = 2;
  });

  it("defaults to the deposits panel", () => {
    renderPage();

    expect(screen.getByText("Lista de depósitos")).toBeInTheDocument();
    expect(screen.queryByText("Lista de cobranças")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Depósitos/i })).toHaveAttribute("aria-selected", "true");
  });

  it("opens Cobranças from the query string", () => {
    renderPage("/dashboard/settings/earnings?view=charges");

    expect(screen.getByText("Lista de cobranças")).toBeInTheDocument();
    expect(screen.queryByText("Lista de depósitos")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Cobranças/i })).toHaveAttribute("aria-selected", "true");
  });

  it("switches to Cobranças when that panel is selected", () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: /Cobranças/i }));
    expect(screen.getByText("Lista de cobranças")).toBeInTheDocument();
  });

  it("switches period chips", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));
    expect(screen.getByRole("button", { name: "3 meses" })).toHaveAttribute("aria-pressed", "true");
  });
});
