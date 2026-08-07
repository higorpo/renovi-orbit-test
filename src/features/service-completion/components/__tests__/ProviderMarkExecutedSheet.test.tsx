// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderMarkExecutedSheet } from "../ProviderMarkExecutedSheet";

const wizardProps: { onExecuted?: () => void } = {};

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => true,
}));

vi.mock("../ProviderExecutedWizard", () => ({
  ProviderExecutedWizard: (props: {
    onExecuted?: () => void;
    onPendingChange?: (pending: boolean) => void;
  }) => {
    wizardProps.onExecuted = props.onExecuted;
    return createElement(
      "div",
      { "data-testid": "provider-executed-wizard" },
      createElement(
        "button",
        {
          type: "button",
          "data-testid": "fake-mark-executed",
          onClick: () => props.onExecuted?.(),
        },
        "Submit",
      ),
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

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("ProviderMarkExecutedSheet", () => {
  beforeEach(() => {
    wizardProps.onExecuted = undefined;
  });

  it("stays open on the success step after mark-executed", () => {
    const onOpenChange = vi.fn();
    const onExecuted = vi.fn();

    render(
      <ProviderMarkExecutedSheet
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
        onExecuted={onExecuted}
      />,
      { wrapper },
    );

    expect(screen.getByTestId("provider-executed-wizard")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("fake-mark-executed"));

    expect(onExecuted).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("provider-executed-success")).toBeInTheDocument();
    expect(
      screen.queryByTestId("provider-executed-wizard"),
    ).not.toBeInTheDocument();
    // Visible checklist header copy is hidden; title stays for a11y only.
    expect(
      screen.queryByRole("heading", { name: "Checklist de conclusão" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Checklist enviado com sucesso" }),
    ).toBeInTheDocument();
  });

  it("closes when Entendi is pressed on the success step", () => {
    const onOpenChange = vi.fn();

    render(
      <ProviderMarkExecutedSheet
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByTestId("fake-mark-executed"));
    fireEvent.click(screen.getByTestId("provider-executed-success-dismiss"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets to checklist when reopened", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ProviderMarkExecutedSheet
        open
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByTestId("fake-mark-executed"));
    expect(screen.getByTestId("provider-executed-success")).toBeInTheDocument();

    rerender(
      <ProviderMarkExecutedSheet
        open={false}
        onOpenChange={onOpenChange}
        serviceRequestId="sr-1"
      />,
    );

    act(() => {
      rerender(
        <ProviderMarkExecutedSheet
          open
          onOpenChange={onOpenChange}
          serviceRequestId="sr-1"
        />,
      );
    });

    expect(screen.getByTestId("provider-executed-wizard")).toBeInTheDocument();
    expect(
      screen.queryByTestId("provider-executed-success"),
    ).not.toBeInTheDocument();
  });
});
