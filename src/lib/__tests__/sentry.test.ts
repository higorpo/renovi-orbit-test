import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(() => "event-id"),
  captureFeedback: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  browserTracingIntegration: vi.fn(() => "tracing"),
  replayIntegration: vi.fn(() => "replay"),
  supabaseIntegration: vi.fn(() => "supabase"),
  zodErrorsIntegration: vi.fn(() => "zod"),
  count: vi.fn(),
  distribution: vi.fn(),
  getCurrentScope: vi.fn(() => ({
    getScopeData: () => ({ tags: {} }),
  })),
}));

vi.mock("@sentry/react", () => ({
  ...sentryMocks,
  metrics: {
    count: sentryMocks.count,
    distribution: sentryMocks.distribution,
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { name: "mock-client" },
}));

vi.mock("@/lib/sentryPiiScrubbing", () => ({
  scrubSentryEvent: vi.fn((event) => ({ ...event, scrubbed: true })),
  scrubSentryBreadcrumbData: vi.fn((data) => ({ ...data, scrubbed: true })),
}));

vi.mock("@/features/chats/utils/sentryChatScrubbing", () => ({
  isChatSentryFeature: vi.fn(() => false),
  scrubChatBreadcrumbData: vi.fn((data) => data),
  scrubChatSentryEvent: vi.fn((event) => event),
}));

async function loadSentry(dsn = "https://dsn.example/1") {
  vi.stubEnv("VITE_SENTRY_DSN", dsn);
  vi.resetModules();
  return import("../sentry");
}

describe("sentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("keeps helpers as no-ops when no DSN is configured", async () => {
    const module = await loadSentry("");

    expect(module.isSentryEnabled()).toBe(false);
    module.initSentry();
    expect(module.captureException(new Error("boom"))).toBeUndefined();
    module.captureUserFeedback({ event_id: "1", comments: "details" });
    module.setSentryUser({ id: "u1" });
    module.addBreadcrumb({ message: "step" });
    module.metrics.count("metric");

    expect(sentryMocks.init).not.toHaveBeenCalled();
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
    expect(sentryMocks.addBreadcrumb).not.toHaveBeenCalled();
  });

  it("stays disabled when the DSN environment variable is absent", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", undefined);
    vi.resetModules();
    const module = await import("../sentry");

    expect(module.isSentryEnabled()).toBe(false);
  });

  it("initializes once with privacy integrations and sampling", async () => {
    const module = await loadSentry();

    module.initSentry();
    module.initSentry();

    expect(sentryMocks.init).toHaveBeenCalledOnce();
    expect(sentryMocks.replayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      blockAllMedia: true,
    });
    expect(sentryMocks.supabaseIntegration).toHaveBeenCalledWith({
      supabaseClient: { name: "mock-client" },
    });
    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://dsn.example/1",
        integrations: ["tracing", "replay", "supabase", "zod"],
        replaysOnErrorSampleRate: 1,
      }),
    );
  });

  it("drops noisy observer errors and scrubs reportable events", async () => {
    const module = await loadSentry();
    module.initSentry();
    const options = sentryMocks.init.mock.calls[0][0];
    const event = { tags: {} };

    expect(
      options.beforeSend(event, {
        originalException: new Error("ResizeObserver loop"),
      }),
    ).toBeNull();
    expect(
      options.beforeSend(event, { originalException: new Error("real failure") }),
    ).toEqual({ tags: {}, scrubbed: true });
  });

  it("scrubs breadcrumb data and leaves data-less breadcrumbs unchanged", async () => {
    const module = await loadSentry();
    module.initSentry();
    const options = sentryMocks.init.mock.calls[0][0];
    const plain = { message: "plain" };

    expect(options.beforeBreadcrumb(plain)).toBe(plain);
    expect(
      options.beforeBreadcrumb({ message: "with data", data: { email: "private" } }),
    ).toEqual({
      message: "with data",
      data: { email: "private", scrubbed: true },
    });
  });

  it("forwards errors, feedback, users, and scrubbed breadcrumbs", async () => {
    const module = await loadSentry();
    const error = new Error("boom");

    expect(module.captureException(error, { step: "save" })).toBe("event-id");
    module.captureUserFeedback({
      event_id: "event-id",
      name: "User",
      email: "user@example.com",
      comments: "What happened",
    });
    module.setSentryUser({ id: "u1", email: "" });
    module.setSentryUser(null);
    module.addBreadcrumb({ message: "saved", data: { value: "safe" } });

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error, {
      extra: { step: "save" },
    });
    expect(sentryMocks.captureFeedback).toHaveBeenCalledWith({
      message: "What happened",
      name: "User",
      email: "user@example.com",
      associatedEventId: "event-id",
    });
    expect(sentryMocks.setUser).toHaveBeenNthCalledWith(1, { id: "u1" });
    expect(sentryMocks.setUser).toHaveBeenNthCalledWith(2, null);
    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith({
      category: "app",
      message: "saved",
      level: "info",
      data: { value: "safe", scrubbed: true },
    });
  });

  it("forwards metrics and absorbs unsupported metric errors", async () => {
    const module = await loadSentry();

    module.metrics.count("jobs", 2, { role: "provider" });
    module.metrics.distribution("latency", 25);
    sentryMocks.count.mockImplementationOnce(() => {
      throw new Error("unsupported");
    });

    expect(() => module.metrics.count("safe")).not.toThrow();
    expect(sentryMocks.count).toHaveBeenCalledWith("jobs", 2, {
      attributes: { role: "provider" },
    });
    expect(sentryMocks.distribution).toHaveBeenCalledWith("latency", 25, undefined);
  });
});

describe("sentry chat scrubbing branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("applies chat-specific event and breadcrumb scrubbing", async () => {
    const chatScrubbing = await import("@/features/chats/utils/sentryChatScrubbing");
    vi.mocked(chatScrubbing.isChatSentryFeature).mockReturnValue(true);
    vi.mocked(chatScrubbing.scrubChatSentryEvent).mockImplementation((event) => ({
      ...event,
      chatScrubbed: true,
    }));
    vi.mocked(chatScrubbing.scrubChatBreadcrumbData).mockImplementation((data) => ({
      ...data,
      chatScrubbed: true,
    }));
    sentryMocks.getCurrentScope.mockReturnValue({
      getScopeData: () => ({ tags: { feature: "chat" } }),
    });

    const module = await loadSentry();
    module.initSentry();
    const options = sentryMocks.init.mock.calls[0][0];

    expect(options.beforeSend({ tags: { feature: "chat" } }, {})).toMatchObject({
      scrubbed: true,
      chatScrubbed: true,
    });
    module.addBreadcrumb({ message: "chat step", data: { body: "private" } });
    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scrubbed: true, chatScrubbed: true }),
      }),
    );
  });

  it("keeps scrubbed data when chat scrubbers return undefined", async () => {
    const chatScrubbing = await import("@/features/chats/utils/sentryChatScrubbing");
    vi.mocked(chatScrubbing.isChatSentryFeature).mockReturnValue(true);
    vi.mocked(chatScrubbing.scrubChatBreadcrumbData).mockReturnValue(undefined);
    sentryMocks.getCurrentScope.mockReturnValue({
      getScopeData: () => ({ tags: { feature: "chat" } }),
    });

    const module = await loadSentry();
    module.addBreadcrumb({ message: "chat step", data: { safe: true } });

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { safe: true, scrubbed: true },
      }),
    );
  });

  it("forwards a non-empty user email and absorbs distribution errors", async () => {
    const module = await loadSentry();
    module.setSentryUser({ id: "u2", email: "user@example.com" });
    expect(sentryMocks.setUser).toHaveBeenCalledWith({
      id: "u2",
      email: "user@example.com",
    });

    sentryMocks.distribution.mockImplementationOnce(() => {
      throw new Error("unsupported");
    });
    expect(() => module.metrics.distribution("latency", 10, { route: "chat" })).not.toThrow();
    module.metrics.count("default-count");
    expect(sentryMocks.count).toHaveBeenCalledWith("default-count", 1, undefined);
  });

  it("accepts breadcrumbs without data and non-object original exceptions", async () => {
    const chatScrubbing = await import("@/features/chats/utils/sentryChatScrubbing");
    vi.mocked(chatScrubbing.isChatSentryFeature).mockReturnValue(false);
    const module = await loadSentry();
    module.initSentry();
    const options = sentryMocks.init.mock.calls[0][0];

    module.addBreadcrumb({ message: "plain", category: "flow", level: "warning" });
    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith({
      category: "flow",
      message: "plain",
      level: "warning",
      data: undefined,
    });
    expect(options.beforeSend({ tags: {} }, { originalException: "failure" })).toEqual({
      tags: {},
      scrubbed: true,
    });
    expect(options.beforeSend({ tags: {} }, { originalException: {} })).toEqual({
      tags: {},
      scrubbed: true,
    });
  });

  it("covers defensive scrubbing and optional Sentry payload fields", async () => {
    const piiScrubbing = await import("@/lib/sentryPiiScrubbing");
    vi.mocked(piiScrubbing.scrubSentryBreadcrumbData).mockReturnValueOnce(undefined);
    const module = await loadSentry();
    module.initSentry();
    const options = sentryMocks.init.mock.calls[0][0];
    const error = new Error("without context");

    expect(
      options.beforeSend(
        { tags: {} },
        { originalException: new Error("Non-Error promise rejection") },
      ),
    ).toBeNull();
    expect(
      options.beforeSend({ tags: {} }, { originalException: { message: undefined } }),
    ).toEqual({ tags: {}, scrubbed: true });

    expect(module.captureException(error)).toBe("event-id");
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error, { extra: undefined });

    module.setSentryUser({ id: "u-null-email", email: null });
    expect(sentryMocks.setUser).toHaveBeenCalledWith({ id: "u-null-email" });

    module.addBreadcrumb({ message: "fallback scrub", data: { safe: true } });
    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ data: { safe: true } }),
    );
  });
});
