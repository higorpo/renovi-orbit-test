// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CardStep } from "../CardStep";
import * as clearsaleApi from "../../../api/clearsale.api";
import * as injectSdkModule from "../../../utils/injectClearSaleSdk";
import * as failClosedModule from "../../../utils/isClearSaleProductionFailClosed";

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
    vi.spyOn(failClosedModule, "isClearSaleProductionFailClosed").mockReturnValue(false);
    vi.spyOn(clearsaleApi, "issueClearSaleSession").mockResolvedValue({
      sessionId: "11111111-1111-4111-8111-111111111111",
      expiresAt: "2099-01-01T00:00:00Z",
      error: null,
    });
    vi.spyOn(injectSdkModule, "injectClearSaleSdk").mockImplementation((options) => {
      options.onInitialized?.();
      return () => {};
    });
  });

  it("issues a server session and unlocks after SDK init", async () => {
    const onSessionIdGenerated = vi.fn();
    render(
      <CardStep
        purpose="accept"
        proposalId="proposal-1"
        onSessionIdGenerated={onSessionIdGenerated}
      />,
    );

    await waitFor(() => {
      expect(clearsaleApi.issueClearSaleSession).toHaveBeenCalledWith({
        purpose: "accept",
        proposalId: "proposal-1",
        scheduleId: undefined,
      });
      expect(onSessionIdGenerated).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
      );
    });
  });

  it("does not unlock confirm on SDK load failure in production", async () => {
    const { logger } = await import("@/lib/logger");
    vi.spyOn(failClosedModule, "isClearSaleProductionFailClosed").mockReturnValue(true);
    vi.spyOn(injectSdkModule, "injectClearSaleSdk").mockImplementation((options) => {
      options.onLoadFailed?.();
      return () => {};
    });

    const onSessionIdGenerated = vi.fn();
    render(
      <CardStep
        purpose="accept"
        proposalId="proposal-1"
        onSessionIdGenerated={onSessionIdGenerated}
      />,
    );

    await waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "clearsale_sdk_load_failed",
        expect.objectContaining({
          session_id: "11111111-1111-4111-8111-111111111111",
        }),
      );
      expect(onSessionIdGenerated).toHaveBeenCalledWith(null);
    });
  });

  it("keeps issued session after unmount so checkout can confirm later", async () => {
    const onSessionIdGenerated = vi.fn();
    const { unmount } = render(
      <CardStep
        purpose="manual"
        scheduleId="schedule-1"
        onSessionIdGenerated={onSessionIdGenerated}
      />,
    );

    await waitFor(() => {
      expect(onSessionIdGenerated).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
      );
    });

    unmount();
    expect(onSessionIdGenerated).not.toHaveBeenCalledWith(null);
  });

  it("does not unlock confirm when session issue returns no sessionId", async () => {
    const { logger } = await import("@/lib/logger");
    vi.spyOn(clearsaleApi, "issueClearSaleSession").mockResolvedValue({
      sessionId: null,
      expiresAt: null,
      error: "CLEARSALE_SESSION_FORBIDDEN",
    });

    const onSessionIdGenerated = vi.fn();
    render(
      <CardStep
        purpose="accept"
        proposalId="proposal-1"
        onSessionIdGenerated={onSessionIdGenerated}
      />,
    );

    await waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "clearsale_issue_session_unavailable",
        expect.objectContaining({ session_id: null }),
      );
      expect(onSessionIdGenerated).toHaveBeenCalledWith(null);
    });
  });

  it("does not unlock confirm when ClearSale app key is missing in production", async () => {
    const { logger } = await import("@/lib/logger");
    vi.spyOn(failClosedModule, "isClearSaleProductionFailClosed").mockReturnValue(true);
    vi.stubEnv("VITE_CLEARSALE_APP_KEY", "");

    const onSessionIdGenerated = vi.fn();
    render(
      <CardStep
        purpose="accept"
        proposalId="proposal-1"
        onSessionIdGenerated={onSessionIdGenerated}
      />,
    );

    await waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "clearsale_app_key_missing",
        expect.objectContaining({
          session_id: "11111111-1111-4111-8111-111111111111",
        }),
      );
      expect(onSessionIdGenerated).toHaveBeenCalledWith(null);
      expect(injectSdkModule.injectClearSaleSdk).not.toHaveBeenCalled();
    });
  });

  it("degrades with issued session when app key is missing outside production", async () => {
    const { logger } = await import("@/lib/logger");
    vi.spyOn(failClosedModule, "isClearSaleProductionFailClosed").mockReturnValue(false);
    vi.stubEnv("VITE_CLEARSALE_APP_KEY", "   ");

    const onSessionIdGenerated = vi.fn();
    render(
      <CardStep
        purpose="manual"
        scheduleId="schedule-1"
        onSessionIdGenerated={onSessionIdGenerated}
      />,
    );

    await waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "clearsale_app_key_missing",
        expect.any(Object),
      );
      expect(onSessionIdGenerated).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
      );
      expect(injectSdkModule.injectClearSaleSdk).not.toHaveBeenCalled();
    });
  });

  it("ignores late session issue after unmount", async () => {
    let resolveIssue!: (value: {
      sessionId: string;
      expiresAt: string;
      error: null;
    }) => void;
    vi.spyOn(clearsaleApi, "issueClearSaleSession").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIssue = resolve;
        }),
    );

    const onSessionIdGenerated = vi.fn();
    const { unmount } = render(
      <CardStep
        purpose="accept"
        proposalId="proposal-1"
        onSessionIdGenerated={onSessionIdGenerated}
      />,
    );

    unmount();
    resolveIssue({
      sessionId: "11111111-1111-4111-8111-111111111111",
      expiresAt: "2099-01-01T00:00:00Z",
      error: null,
    });

    await Promise.resolve();
    expect(onSessionIdGenerated).not.toHaveBeenCalled();
    expect(injectSdkModule.injectClearSaleSdk).not.toHaveBeenCalled();
  });
});
