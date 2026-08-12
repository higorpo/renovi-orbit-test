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
  onPeriodChange = vi.fn(),
  period: "month" | "3m" | "6m" = "month",
) {
  return render(
    <Tabs value={view} onValueChange={(value) => onViewChange(value)}>
      <EarningsLedgerSwitch
        view={view}
        summary={{ ...summary, ...overrides }}
        period={period}
        onViewChange={onViewChange}
        onPeriodChange={onPeriodChange}
      />
    </Tabs>,
  );
}

describe("EarningsLedgerSwitch", () => {
  it("shows agreed capture total, deposit count, and period chips", () => {
    renderSwitch();

    expect(screen.getByRole("tab", { name: /Cobranças/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Depósitos/i })).toBeInTheDocument();
    expect(screen.getByText(/1\.250,50/)).toBeInTheDocument();
    expect(screen.getByText("3 depósitos")).toBeInTheDocument();
    expect(screen.getByText(/Líquido após estornos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Este mês" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "3 meses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6 meses" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Listas de ganhos" })).not.toHaveTextContent(
      /30 dias/,
    );
    expect(screen.getByText(/cerca de 30 dias/i)).toBeInTheDocument();
    expect(screen.getByText("Valor combinado")).toBeInTheDocument();
    expect(screen.getByText("Na sua conta")).toBeInTheDocument();
    expect(screen.queryByText("Lista abaixo")).not.toBeInTheDocument();
    expect(screen.queryByText("Toque para ver a lista")).not.toBeInTheDocument();
  });

  it("marks the selected list without device-specific copy", () => {
    renderSwitch("charges");
    expect(screen.getByRole("tab", { name: /Cobranças/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Depósitos/i })).toHaveAttribute("aria-selected", "false");
  });

  it("notifies when the other list is selected", () => {
    const onViewChange = vi.fn();
    renderSwitch("deposits", {}, onViewChange);
    fireEvent.click(screen.getByRole("tab", { name: /Cobranças/i }));
    expect(onViewChange).toHaveBeenCalledWith("charges");
  });

  it("notifies when the period changes", () => {
    const onPeriodChange = vi.fn();
    renderSwitch("deposits", {}, vi.fn(), onPeriodChange);
    fireEvent.click(screen.getByRole("button", { name: "3 meses" }));
    expect(onPeriodChange).toHaveBeenCalledWith("3m");
  });

  it("shows a singular deposit label", () => {
    renderSwitch("deposits", { depositCount: 1, hasClawback: false });
    expect(screen.getByText("1 depósito")).toBeInTheDocument();
    expect(screen.queryByText(/Líquido após estornos/i)).not.toBeInTheDocument();
  });
});
