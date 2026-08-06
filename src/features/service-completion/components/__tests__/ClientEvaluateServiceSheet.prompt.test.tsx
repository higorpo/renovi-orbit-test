import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wizardMocks = vi.hoisted(() => ({
  mounted: vi.fn(),
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

vi.mock("../ClientConfirmRatingWizard", () => ({
  ClientConfirmRatingWizard: (props: {
    serviceRequestId: string;
    variant?: string;
    onStepChange?: (step: "review" | "rating", label: string) => void;
  }) => {
    wizardMocks.mounted(props);
    return (
      <div
        data-testid="client-confirm-rating-wizard-mock"
        data-variant={props.variant}
      >
        wizard
      </div>
    );
  },
}));

vi.mock("../CompletionFlowSheetDialog", () => ({
  CompletionFlowSheetDialog: (props: {
    open: boolean;
    title: string;
    description?: string;
    headerAside?: React.ReactNode;
    children: React.ReactNode;
    testId?: string;
  }) =>
    props.open ? (
      <div data-testid={props.testId}>
        <h2>{props.title}</h2>
        {props.description ? <p>{props.description}</p> : null}
        {props.headerAside}
        {props.children}
      </div>
    ) : null,
}));

import { ClientEvaluateServiceSheet } from "../ClientEvaluateServiceSheet";

describe("ClientEvaluateServiceSheet prompt variant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows intro first and mounts wizard only after Continuar", async () => {
    render(
      <ClientEvaluateServiceSheet
        open
        onOpenChange={vi.fn()}
        serviceRequestId="sr-1"
        variant="prompt"
        promptSummary={{
          title: "Pintura sala",
          categoryTitle: "Pintura",
          providerFullName: "Ana Silva",
          scheduledStartDate: "2026-08-05",
          scheduledEndDate: null,
        }}
      />,
    );

    expect(
      screen.getByText("É hora de avaliar a execução do serviço"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    expect(
      screen.queryByTestId("client-confirm-rating-wizard-mock"),
    ).not.toBeInTheDocument();
    expect(wizardMocks.mounted).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("pending-evaluation-intro-continue"));

    await waitFor(() => {
      expect(
        screen.getByTestId("client-confirm-rating-wizard-mock"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
    expect(wizardMocks.mounted).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceRequestId: "sr-1",
        variant: "prompt",
      }),
    );
  });

  it("keeps default two-step flow without intro", () => {
    render(
      <ClientEvaluateServiceSheet
        open
        onOpenChange={vi.fn()}
        serviceRequestId="sr-1"
      />,
    );

    expect(screen.getByText("Avaliar serviço")).toBeInTheDocument();
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(
      screen.getByTestId("client-confirm-rating-wizard-mock"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("pending-evaluation-intro"),
    ).not.toBeInTheDocument();
  });
});
