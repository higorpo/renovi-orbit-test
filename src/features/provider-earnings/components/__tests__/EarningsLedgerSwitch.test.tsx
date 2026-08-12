import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/tabs";
import type { EarningsLedgerSummary } from "../EarningsLedgerSwitch";
import { EarningsLedgerSwitch } from "../EarningsLedgerSwitch";

const summary: EarningsLedgerSummary = {
  agreedTotal: 1250.5,
  netTotal: 1100,
  hasClawback: true,
  depositCount: 3,
  isLoadingReceivables: false,
  isLoadingDeposits: false,
  isErrorReceivables: false,
  isErrorDeposits: false,
};

function renderSwitch(
  view: "deposits" | "charges" = "deposits",
  overrides: Partial<EarningsLedgerSummary> = {},
  onViewChange = vi.fn(),
) {
  return render(
    <Tabs value={view} onValueChange={(value) => onViewChange(value)}>
      <EarningsLedgerSwitch
        view={view}
        summary={{ ...summary, ...overrides }}
        onViewChange={onViewChange}
      />
    </Tabs>,
  );
}

describe("EarningsLedgerSwitch", () => {
  it("shows agreed capture total and deposit count", () => {
    renderSwitch();

    expect(screen.getByRole("tab", { name: /Cobranças/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Depósitos/i })).toBeInTheDocument();
    expect(screen.getByText(/1\.250,50/)).toBeInTheDocument();
    expect(screen.getByText("3 depósitos")).toBeInTheDocument();
    expect(screen.getByText(/Líquido após estornos/i)).toBeInTheDocument();
    expect(screen.getByText(/pode ser parcelado/i)).toBeInTheDocument();
  });

  it("marks the active panel from view", () => {
    renderSwitch("charges");
    expect(screen.getByRole("tab", { name: /Cobranças/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Depósitos/i })).toHaveAttribute("aria-selected", "false");
  });

  it("notifies when the other panel is selected", () => {
    const onViewChange = vi.fn();
    renderSwitch("deposits", {}, onViewChange);
    fireEvent.click(screen.getByRole("tab", { name: /Cobranças/i }));
    expect(onViewChange).toHaveBeenCalledWith("charges");
  });

  it("shows a singular deposit label", () => {
    renderSwitch("deposits", { depositCount: 1, hasClawback: false });
    expect(screen.getByText("1 depósito")).toBeInTheDocument();
    expect(screen.queryByText(/Líquido após estornos/i)).not.toBeInTheDocument();
  });
});
