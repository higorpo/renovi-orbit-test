import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

import { PendingEvaluationIntroStep } from "../PendingEvaluationIntroStep";

describe("PendingEvaluationIntroStep", () => {
  it("renders summary and continues on CTA", () => {
    const onContinue = vi.fn();

    render(
      <PendingEvaluationIntroStep
        summary={{
          title: "Pintura sala",
          categoryTitle: "Pintura",
          providerFullName: "Ana Silva",
          executedAt: "2026-08-06T12:00:00.000Z",
          scheduledStartDate: "2026-08-05",
        }}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByTestId("pending-evaluation-intro")).toBeInTheDocument();
    expect(screen.getByText("Pintura sala")).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId("pending-evaluation-intro-continue"),
    );
    expect(onContinue).toHaveBeenCalled();
  });
});
