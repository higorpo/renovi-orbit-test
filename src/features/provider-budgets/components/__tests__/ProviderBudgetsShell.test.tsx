import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProviderBudgetsShell } from "../ProviderBudgetsShell";
import { ProviderBudgetsRouteSlot } from "../ProviderBudgetsRouteSlot";

describe("ProviderBudgetsShell", () => {
  it("ProviderBudgetsRouteSlot renders nothing", () => {
    const { container } = render(<ProviderBudgetsRouteSlot />);
    expect(container.firstChild).toBeNull();
  });

  it("ProviderBudgetsShell renders nothing", () => {
    const { container } = render(<ProviderBudgetsShell />);
    expect(container.firstChild).toBeNull();
  });
});
