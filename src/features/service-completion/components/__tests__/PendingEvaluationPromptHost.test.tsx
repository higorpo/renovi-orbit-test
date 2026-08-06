import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hookMocks = vi.hoisted(() => ({
  open: true,
  serviceRequestId: "sr-1" as string | null,
  promptSummary: {
    title: "Pintura",
    categoryTitle: "Pintura",
    providerFullName: "Ana Silva",
    scheduledStartDate: "2026-08-05",
    scheduledEndDate: null,
    iconKey: "Paintbrush",
    colorKey: "amber_orange",
  } as {
    title: string;
    categoryTitle: string | null;
    providerFullName: string | null;
    scheduledStartDate: string | null;
    scheduledEndDate: string | null;
    iconKey: string | null;
    colorKey: string | null;
  } | null,
  setOpen: vi.fn(),
  dismiss: vi.fn(),
  onCompleted: vi.fn(),
}));

vi.mock("../../hooks/usePendingEvaluationPrompt", () => ({
  usePendingEvaluationPrompt: () => hookMocks,
}));

vi.mock("../ClientEvaluateServiceSheet", () => ({
  ClientEvaluateServiceSheet: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCompleted?: () => void;
    variant?: string;
    testId?: string;
  }) => (
    <div data-testid={props.testId} data-open={String(props.open)} data-variant={props.variant}>
      <button type="button" onClick={() => props.onOpenChange(false)}>
        close
      </button>
      <button type="button" onClick={() => props.onCompleted?.()}>
        completed
      </button>
    </div>
  ),
}));

import { PendingEvaluationPromptHost } from "../PendingEvaluationPromptHost";

describe("PendingEvaluationPromptHost", () => {
  it("renders nothing without an active prompt", () => {
    hookMocks.serviceRequestId = null;
    hookMocks.promptSummary = null;

    const { container } = render(<PendingEvaluationPromptHost />);
    expect(container).toBeEmptyDOMElement();
  });

  it("wires prompt sheet with variant prompt", () => {
    hookMocks.serviceRequestId = "sr-1";
    hookMocks.promptSummary = {
      title: "Pintura",
      categoryTitle: "Pintura",
      providerFullName: "Ana Silva",
      scheduledStartDate: "2026-08-05",
      scheduledEndDate: null,
      iconKey: "Paintbrush",
      colorKey: "amber_orange",
    };
    hookMocks.open = true;

    render(<PendingEvaluationPromptHost />);

    expect(
      screen.getByTestId("pending-evaluation-prompt-sheet"),
    ).toHaveAttribute("data-variant", "prompt");

    fireEvent.click(screen.getByRole("button", { name: "close" }));
    fireEvent.click(screen.getByRole("button", { name: "completed" }));

    expect(hookMocks.setOpen).toHaveBeenCalledWith(false);
    expect(hookMocks.onCompleted).toHaveBeenCalled();
  });
});
