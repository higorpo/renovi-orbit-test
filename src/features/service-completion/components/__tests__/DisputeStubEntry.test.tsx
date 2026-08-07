// @vitest-environment happy-dom
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DisputeStubEntry,
  shouldShowDisputeStub,
} from "../DisputeStubEntry";
import { DISPUTE_STUB_ANALYTICS_EVENT } from "../../utils/disputeSupportUrl";

const trackEvent = vi.fn();

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}));

vi.mock("sonner", () => ({
  toast: { message: vi.fn() },
}));

describe("shouldShowDisputeStub", () => {
  it("shows for capability or EXECUTED only (not after COMPLETED)", () => {
    expect(shouldShowDisputeStub({ showDisputeStubCapability: true })).toBe(
      true,
    );
    expect(shouldShowDisputeStub({ csStatus: "EXECUTED" })).toBe(true);
    expect(shouldShowDisputeStub({ csStatus: "COMPLETED" })).toBe(false);
    expect(shouldShowDisputeStub({ csStatus: "CONFIRMED" })).toBe(false);
  });
});

describe("DisputeStubEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_SERVICE_COMPLETION_DISPUTE_SUPPORT_URL", "");
  });

  it("renders Abrir disputa copy and fires analytics on tap without status mutation APIs", () => {
    render(
      <DisputeStubEntry contractedServiceId="cs-1" csStatus="EXECUTED" />,
    );

    expect(screen.getByTestId("dispute-stub-entry")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Se você acha que há algo errado na execução do serviço/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Falar com o suporte/i })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("dispute-stub-open"));
    expect(trackEvent).toHaveBeenCalledWith(DISPUTE_STUB_ANALYTICS_EVENT, {
      contracted_service_id: "cs-1",
      cs_status: "EXECUTED",
    });
  });
});
