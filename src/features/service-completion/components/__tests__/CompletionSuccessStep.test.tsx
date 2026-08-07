// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageCircle } from "lucide-react";
import { CompletionSuccessStep } from "../CompletionSuccessStep";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
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

describe("CompletionSuccessStep", () => {
  it("renders injected copy and dismisses", () => {
    const onDismiss = vi.fn();
    render(
      <CompletionSuccessStep
        eyebrow="Eyebrow"
        title="Success title"
        description="Success description"
        tipsHeading="Tips heading"
        tipsSubheading="Tips subheading"
        tips={[
          {
            icon: MessageCircle,
            title: "Tip one",
            body: "Tip body",
          },
        ]}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByTestId("completion-success")).toBeInTheDocument();
    expect(screen.getByText("Success title")).toBeInTheDocument();
    expect(screen.getByText("Tips heading")).toBeInTheDocument();
    expect(screen.getByText("Tip one")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("completion-success-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
