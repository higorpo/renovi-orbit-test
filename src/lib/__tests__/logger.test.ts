import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  isSentryEnabled: vi.fn(() => false),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/sentry", () => ({
  captureException: sentryMocks.captureException,
  addBreadcrumb: sentryMocks.addBreadcrumb,
  isSentryEnabled: sentryMocks.isSentryEnabled,
  Sentry: { logger: sentryMocks.logger },
}));

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    sentryMocks.isSentryEnabled.mockReturnValue(false);
  });

  it("writes debug/info/warn/error to console in development", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.resetModules();

    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { logger } = await import("../logger");

    logger.debug("debug_event", { step: 1 });
    logger.info("info_event", { step: 2 });
    logger.warn("warn_event", { step: 3 });
    logger.error("error_event", { step: 4 });

    expect(debugSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("[warn]", "warn_event", { step: 3 });
    expect(errorSpy).toHaveBeenCalledWith("[error]", "error_event", { step: 4 });

    debugSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("forwards error and warn to Sentry with breadcrumbs and log attributes", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    sentryMocks.isSentryEnabled.mockReturnValue(true);
    vi.resetModules();

    const { logger } = await import("../logger");
    const boom = new Error("boom");

    logger.error("failed", { error: boom, userId: "u1" });
    logger.warn("slow", { reason: "timeout" });
    logger.info("ok", { count: 1 });
    logger.debug("skipped_in_prod", { count: 2 });

    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      boom,
      expect.objectContaining({ event: "failed", userId: "u1" }),
    );
    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ event: "slow", level: "warn" }),
    );
    expect(sentryMocks.addBreadcrumb).toHaveBeenCalled();
    expect(sentryMocks.logger.error).toHaveBeenCalledWith(
      "failed",
      expect.objectContaining({
        event: "failed",
        error_message: "boom",
        error_name: "Error",
        userId: "u1",
      }),
    );
    expect(sentryMocks.logger.warn).toHaveBeenCalled();
    expect(sentryMocks.logger.info).toHaveBeenCalled();
  });

  it("swallows Sentry logger failures", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    sentryMocks.isSentryEnabled.mockReturnValue(true);
    sentryMocks.logger.info.mockImplementation(() => {
      throw new Error("logs unavailable");
    });
    vi.resetModules();

    const { logger } = await import("../logger");
    expect(() => logger.info("still_ok")).not.toThrow();
  });

  it("skips debug in production and does not call Sentry when disabled", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    sentryMocks.isSentryEnabled.mockReturnValue(false);
    vi.resetModules();

    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const { logger } = await import("../logger");

    logger.debug("skipped_debug", { step: 1 });
    logger.info("info_no_sentry", { step: 2 });
    logger.warn("warn_no_sentry", { step: 3 });
    logger.error("error_no_sentry", { step: 4 });

    expect(debugSpy).not.toHaveBeenCalled();
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
    expect(sentryMocks.addBreadcrumb).not.toHaveBeenCalled();
    expect(sentryMocks.logger.debug).not.toHaveBeenCalled();
    expect(sentryMocks.logger.info).not.toHaveBeenCalled();

    debugSpy.mockRestore();
  });

  it("creates Error from event when error context is not an Error instance", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    sentryMocks.isSentryEnabled.mockReturnValue(true);
    vi.resetModules();

    const { logger } = await import("../logger");
    logger.error("plain_failure", { reason: "timeout" });

    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "plain_failure" }),
      expect.objectContaining({ event: "plain_failure", reason: "timeout" }),
    );
  });
});
