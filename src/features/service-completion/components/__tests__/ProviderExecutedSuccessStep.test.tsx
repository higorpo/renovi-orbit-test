// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderExecutedSuccessStep } from "../ProviderExecutedSuccessStep";

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

describe("ProviderExecutedSuccessStep", () => {
  it("renders success coaching copy and dismisses on Entendi", () => {
    const onDismiss = vi.fn();
    render(<ProviderExecutedSuccessStep onDismiss={onDismiss} />);

    expect(screen.getByTestId("provider-executed-success")).toBeInTheDocument();
    expect(
      screen.getByText("Checklist enviado com sucesso"),
    ).toBeInTheDocument();
    expect(screen.getByText("Avise o cliente")).toBeInTheDocument();
    expect(screen.getByText(/confirmar o recebimento/i)).toBeInTheDocument();
    expect(
      screen.getByText("Peça para revisar as evidências"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/revisar as evidências e aprovar o serviço/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("provider-executed-success-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
