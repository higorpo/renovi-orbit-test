// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnalytics } from "../useAnalytics";

describe("useAnalytics", () => {
  beforeEach(() => {
    delete window.dataLayer;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T15:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("initializes dataLayer and tracks an event with properties and timestamp", () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);

    useAnalytics().trackEvent("quote_request_started", {
      step: 2,
      source: "dashboard",
      authenticated: true,
    });

    expect(window.dataLayer).toEqual([
      {
        event: "quote_request_started",
        step: 2,
        source: "dashboard",
        authenticated: true,
        timestamp: "2026-07-10T15:30:00.000Z",
      },
    ]);
  });

  it("appends events without replacing an existing dataLayer", () => {
    const existingEvent = { event: "page_view" };
    window.dataLayer = [existingEvent];
    vi.spyOn(console, "debug").mockImplementation(() => undefined);

    useAnalytics().trackEvent("signup_completed");

    expect(window.dataLayer).toHaveLength(2);
    expect(window.dataLayer?.[0]).toBe(existingEvent);
    expect(window.dataLayer?.[1]).toMatchObject({
      event: "signup_completed",
      timestamp: "2026-07-10T15:30:00.000Z",
    });
  });

  it("logs tracked events while running in development", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const properties = { user_role: "provider" };

    useAnalytics().trackEvent("signup_completed", properties);

    expect(debugSpy).toHaveBeenCalledWith(
      "[Analytics]",
      "signup_completed",
      properties,
    );
  });
});
