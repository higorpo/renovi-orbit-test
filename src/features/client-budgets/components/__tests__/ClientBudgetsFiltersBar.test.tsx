import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientBudgetsFiltersBar } from "../ClientBudgetsFiltersBar";

describe("ClientBudgetsFiltersBar", () => {
  it("renders received filters and calls onReceivedStatusChange", () => {
    const onReceived = vi.fn();
    const onQuestion = vi.fn();
    const onSearch = vi.fn();
    render(
      <ClientBudgetsFiltersBar
        activeTab="recebidos"
        receivedStatusFilter="awaiting_decision"
        questionStatusFilter="pending"
        searchQuery=""
        onReceivedStatusChange={onReceived}
        onQuestionStatusChange={onQuestion}
        onSearchChange={onSearch}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Aceitos/i }));
    expect(onReceived).toHaveBeenCalledWith("accepted");
    expect(onQuestion).not.toHaveBeenCalled();
  });

  it("renders question filters when tab is perguntas", () => {
    const onReceived = vi.fn();
    const onQuestion = vi.fn();
    render(
      <ClientBudgetsFiltersBar
        activeTab="perguntas"
        receivedStatusFilter="awaiting_decision"
        questionStatusFilter="pending"
        searchQuery=""
        onReceivedStatusChange={onReceived}
        onQuestionStatusChange={onQuestion}
        onSearchChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /^Respondidas$/i }));
    expect(onQuestion).toHaveBeenCalledWith("answered");
    expect(onReceived).not.toHaveBeenCalled();
  });

  it("search input calls onSearchChange", () => {
    const onSearch = vi.fn();
    render(
      <ClientBudgetsFiltersBar
        activeTab="recebidos"
        receivedStatusFilter="awaiting_decision"
        questionStatusFilter="pending"
        searchQuery="abc"
        onReceivedStatusChange={vi.fn()}
        onQuestionStatusChange={vi.fn()}
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
        activeTab="recebidos"
        receivedStatusFilter="awaiting_decision"
        questionStatusFilter="pending"
        searchQuery=""
        onReceivedStatusChange={vi.fn()}
        onQuestionStatusChange={vi.fn()}
        onSearchChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByPlaceholderText(/Buscar/i)).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Aceitos/i })).toBeDisabled();
  });
});
