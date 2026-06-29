// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CardStep } from "../CardStep";
import * as generateSessionModule from "../../../utils/generateClearSaleSessionId";
import * as injectSdkModule from "../../../utils/injectClearSaleSdk";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("CardStep", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_CLEARSALE_APP_KEY", "test-clearsale-app-key");
    vi.spyOn(injectSdkModule, "injectClearSaleSdk").mockReturnValue(() => {});
  });

  it("keeps the same clearsaleSessionId across re-renders", async () => {
    vi.spyOn(generateSessionModule, "generateClearSaleSessionId").mockReturnValue(
      "stable-session-id",
    );

    const onSessionIdGenerated = vi.fn();
    const { rerender } = render(
      <CardStep onSessionIdGenerated={onSessionIdGenerated} />,
    );

    await waitFor(() => {
      expect(onSessionIdGenerated).toHaveBeenCalledWith("stable-session-id");
    });

    rerender(<CardStep onSessionIdGenerated={onSessionIdGenerated} />);

    expect(onSessionIdGenerated).toHaveBeenCalledTimes(1);
    expect(onSessionIdGenerated).toHaveBeenCalledWith("stable-session-id");
  });

  it("generates a new clearsaleSessionId after unmount and remount", async () => {
    vi.spyOn(generateSessionModule, "generateClearSaleSessionId")
      .mockReturnValueOnce("first-session-id")
      .mockReturnValueOnce("second-session-id");

    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    const { unmount } = render(
      <CardStep onSessionIdGenerated={firstCallback} />,
    );

    await waitFor(() => {
      expect(firstCallback).toHaveBeenCalledWith("first-session-id");
    });

    unmount();

    render(<CardStep onSessionIdGenerated={secondCallback} />);

    await waitFor(() => {
      expect(secondCallback).toHaveBeenCalledWith("second-session-id");
    });
  });

  it("logs a warning when SDK load fails without blocking checkout", async () => {
    const { logger } = await import("@/lib/logger");

    vi.spyOn(generateSessionModule, "generateClearSaleSessionId").mockReturnValue(
      "failed-session-id",
    );

    vi.spyOn(injectSdkModule, "injectClearSaleSdk").mockImplementation((options) => {
      options.onLoadFailed?.();
      return () => {};
    });

    render(<CardStep onSessionIdGenerated={vi.fn()} />);

    await waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith("clearsale_sdk_load_failed", {
        session_id: "failed-session-id",
      });
    });
  });
});
