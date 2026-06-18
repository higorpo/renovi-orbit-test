import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DismissOpportunityButton } from "../DismissOpportunityButton";

describe("DismissOpportunityButton", () => {
  it("renders label and calls onDismiss", () => {
    const onDismiss = vi.fn();
    render(
      <DismissOpportunityButton
        serviceRequestId="sr-1"
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /não tenho interesse/i }));
    expect(onDismiss).toHaveBeenCalledWith("sr-1");
  });
});
