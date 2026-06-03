import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientBudgetsFiltersBar } from "../ClientBudgetsFiltersBar";

describe("ClientBudgetsFiltersBar", () => {
  it("renders received filters and calls onReceivedStatusChange", () => {
    const onReceived = vi.fn();
    const onSearch = vi.fn();
    render(
      <ClientBudgetsFiltersBar
        receivedStatusFilter="awaiting_decision"
        searchQuery=""
        onReceivedStatusChange={onReceived}
        onSearchChange={onSearch}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Aceitos/i }));
    expect(onReceived).toHaveBeenCalledWith("accepted");
  });

  it("search input calls onSearchChange", () => {
    const onSearch = vi.fn();
    render(
      <ClientBudgetsFiltersBar
        receivedStatusFilter="awaiting_decision"
        searchQuery="abc"
        onReceivedStatusChange={vi.fn()}
        onSearchChange={onSearch}
      />,
    );
    const input = screen.getByPlaceholderText(/Buscar/i);
    fireEvent.change(input, { target: { value: "novo" } });
    expect(onSearch).toHaveBeenCalledWith("novo");
  });

  it("disables chips and search when disabled", () => {
    render(
      <ClientBudgetsFiltersBar
        receivedStatusFilter="awaiting_decision"
        searchQuery=""
        onReceivedStatusChange={vi.fn()}
        onSearchChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByPlaceholderText(/Buscar/i)).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Aceitos/i })).toBeDisabled();
  });
});
