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
          scheduledStartDate: "2026-08-05",
          scheduledEndDate: null,
          iconKey: "Paintbrush",
          colorKey: "amber_orange",
        }}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByTestId("pending-evaluation-intro")).toBeInTheDocument();
    expect(
      screen.getByTestId("pending-evaluation-intro-service-icon"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pintura sala")).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText(/Conclusão:/)).toBeInTheDocument();
    expect(screen.queryByText(/Executado em/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Agenda:/)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId("pending-evaluation-intro-continue"),
    );
    expect(onContinue).toHaveBeenCalled();

    const continueButton = screen.getByTestId(
      "pending-evaluation-intro-continue",
    );
    expect(continueButton.parentElement).toHaveClass("shrink-0");
  });

  it("prefers scheduledEndDate over scheduledStartDate for Conclusão", () => {
    render(
      <PendingEvaluationIntroStep
        summary={{
          title: "Pintura sala",
          categoryTitle: null,
          providerFullName: null,
          scheduledStartDate: "2026-08-05",
          scheduledEndDate: "2026-08-07",
          iconKey: null,
          colorKey: null,
        }}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText(/Conclusão:/)).toBeInTheDocument();
    // formatCalendarDate of 2026-08-07 (pt-BR calendar)
    expect(screen.getByText("07/08/2026")).toBeInTheDocument();
    expect(screen.queryByText("05/08/2026")).not.toBeInTheDocument();
  });
});
