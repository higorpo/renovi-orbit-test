import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposeRescheduleFlowReminder } from "../ProposeRescheduleFlowReminder";

describe("ProposeRescheduleFlowReminder", () => {
  it("explains that the official date changes only after client confirmation", () => {
    render(<ProposeRescheduleFlowReminder onDismiss={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Como funciona o reagendamento?");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Você propõe a nova data; o cliente confirma. Só depois disso a data oficial muda.",
    );
  });

  it("calls onDismiss when the close button is pressed", () => {
    const onDismiss = vi.fn();

    render(<ProposeRescheduleFlowReminder onDismiss={onDismiss} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Dispensar lembrete de reagendamento" }),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
