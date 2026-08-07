// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wizardMocks = vi.hoisted(() => ({
  mounted: vi.fn(),
  onCompleted: undefined as (() => void) | undefined,
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

vi.mock("../ClientConfirmRatingWizard", () => ({
  ClientConfirmRatingWizard: (props: {
    serviceRequestId: string;
    variant?: string;
    onStepChange?: (step: "review" | "rating", label: string) => void;
    onCompleted?: () => void;
  }) => {
    wizardMocks.mounted(props);
    wizardMocks.onCompleted = props.onCompleted;
    return (
      <div
        data-testid="client-confirm-rating-wizard-mock"
        data-variant={props.variant}
      >
        <button
          type="button"
          data-testid="fake-client-rating-submit"
          onClick={() => props.onCompleted?.()}
        >
          Submit rating
        </button>
      </div>
    );
  },
}));

vi.mock("framer-motion", () => {
  const passthrough =
    (tag: string) =>
    ({
      children,
      className,
      ...rest
    }: {
      children?: ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => {
      void rest;
      return createElement(tag, { className }, children);
    };

  return {
    motion: {
      div: passthrough("div"),
      p: passthrough("p"),
      h3: passthrough("h3"),
      li: passthrough("li"),
      span: passthrough("span"),
    },
    useReducedMotion: () => true,
  };
});

import { ClientEvaluateServiceSheet } from "../ClientEvaluateServiceSheet";

describe("ClientEvaluateServiceSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wizardMocks.onCompleted = undefined;
  });

  it("shows intro first and mounts wizard only after Continuar (prompt)", async () => {
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
          iconKey: "Paintbrush",
          colorKey: "amber_orange",
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

    fireEvent.click(screen.getByTestId("pending-evaluation-intro-continue"));

    await waitFor(() => {
      expect(
        screen.getByTestId("client-confirm-rating-wizard-mock"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("2 de 3")).toBeInTheDocument();
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
  });

  it("stays open on the success step after rating submit", () => {
    const onOpenChange = vi.fn();
    const onCompleted = vi.fn();

    render(
      <ClientEvaluateServiceSheet
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
        onCompleted={onCompleted}
      />,
    );

    fireEvent.click(screen.getByTestId("fake-client-rating-submit"));

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("client-evaluate-success")).toBeInTheDocument();
    expect(
      screen.queryByTestId("client-confirm-rating-wizard-mock"),
    ).not.toBeInTheDocument();
  });

  it("closes when Entendi is pressed on the success step", () => {
    const onOpenChange = vi.fn();

    render(
      <ClientEvaluateServiceSheet
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
      />,
    );

    fireEvent.click(screen.getByTestId("fake-client-rating-submit"));
    fireEvent.click(screen.getByTestId("client-evaluate-success-dismiss"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
