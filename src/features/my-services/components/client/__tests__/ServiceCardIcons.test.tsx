// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ClientCardHighlightIcon,
  ClientCardInfoIcon,
  clientBudgetActionIcon,
} from "../ClientServiceCardIcons";
import {
  ProviderCardHighlightIcon,
  ProviderCardInfoIcon,
} from "../../provider/ProviderServiceCardIcons";

vi.mock("@/features/view-services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/view-services")>();
  return {
    ...actual,
    getServiceRequestBudgetActionIcon: (phase: string) =>
      phase === "negotiation" ? "negotiation-icon" : "completed-icon",
  };
});

describe("service card icons", () => {
  it("renders client highlight and info icons", () => {
    const { container: highlight } = render(
      <ClientCardHighlightIcon
        icon="payment_pending"
        iconBoxClassName="box"
        iconClassName="icon"
      />,
    );
    expect(highlight.querySelector("svg")).toBeTruthy();

    const { container: info } = render(
      <ClientCardInfoIcon icon="location" className="info" />,
    );
    expect(info.querySelector("svg")).toBeTruthy();

    const { container: infoHint } = render(
      <ClientCardInfoIcon icon="info" className="info" />,
    );
    expect(infoHint.querySelector("svg")).toBeTruthy();
  });

  it("maps client budget action icons by negotiation phase", () => {
    expect(clientBudgetActionIcon(true)).toBe("negotiation-icon");
    expect(clientBudgetActionIcon(false)).toBe("completed-icon");
  });

  it("renders provider highlight and rating info icons", () => {
    const { container: highlight } = render(
      <ProviderCardHighlightIcon
        icon="revision"
        iconBoxClassName="box"
        iconClassName="icon"
      />,
    );
    expect(highlight.querySelector("svg")).toBeTruthy();

    const { container: rating } = render(
      <ProviderCardInfoIcon icon="rating" className="info" />,
    );
    const svg = rating.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.className.toString()).toContain("fill-amber-400");

    const { container: infoHint } = render(
      <ProviderCardInfoIcon icon="info" className="info" />,
    );
    expect(infoHint.querySelector("svg")).toBeTruthy();
  });
});
