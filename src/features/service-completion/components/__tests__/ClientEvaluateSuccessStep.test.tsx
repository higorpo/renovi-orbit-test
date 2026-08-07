// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClientEvaluateSuccessStep } from "../ClientEvaluateSuccessStep";

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

describe("ClientEvaluateSuccessStep", () => {
  it("renders confirm copy and dismisses", () => {
    const onDismiss = vi.fn();
    render(<ClientEvaluateSuccessStep onDismiss={onDismiss} />);

    expect(screen.getByTestId("client-evaluate-success")).toBeInTheDocument();
    expect(
      screen.getByText("Recebimento confirmado. Obrigado!"),
    ).toBeInTheDocument();
    expect(screen.getByText("O que acontece agora")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("client-evaluate-success-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders optional-rating copy", () => {
    render(
      <ClientEvaluateSuccessStep mode="optional" onDismiss={vi.fn()} />,
    );

    expect(
      screen.getByText("Obrigado pela sua avaliação!"),
    ).toBeInTheDocument();
    expect(screen.getByText("Avaliação enviada")).toBeInTheDocument();
  });
});
