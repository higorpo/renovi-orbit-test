import { assertEquals, assertRejects } from "std/testing/asserts";
import {
  initSentryEdge,
  isSentryEnabled,
  resetSentryEdgeForTests,
  withSpan,
} from "../sentrySpans.ts";

Deno.test("isSentryEnabled is false when SENTRY_DSN is unset", () => {
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");
  try {
    assertEquals(isSentryEnabled(), false);
  } finally {
    if (prev !== undefined) Deno.env.set("SENTRY_DSN", prev);
  }
});

Deno.test("initSentryEdge skips when DSN is unset", async () => {
  resetSentryEdgeForTests();
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");
  try {
    await initSentryEdge("test-service");
    assertEquals(isSentryEnabled(), false);
  } finally {
    if (prev !== undefined) Deno.env.set("SENTRY_DSN", prev);
  }
});

Deno.test("withSpan no-op returns callback result when Sentry is disabled", async () => {
  resetSentryEdgeForTests();
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");
  try {
    const value = await withSpan("op", "test", { a: 1 }, async () => "ok");
    assertEquals(value, "ok");
  } finally {
    if (prev !== undefined) Deno.env.set("SENTRY_DSN", prev);
  }
});

Deno.test("withSpan rethrows callback errors when Sentry is disabled", async () => {
  resetSentryEdgeForTests();
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");
  try {
    await assertRejects(
      () =>
        withSpan("op", "test", {}, async () => {
          throw new Error("span failed");
        }),
      Error,
      "span failed",
    );
  } finally {
    if (prev !== undefined) Deno.env.set("SENTRY_DSN", prev);
  }
});

Deno.test("withSpan rethrows non-Error values when Sentry is disabled", async () => {
  resetSentryEdgeForTests();
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");
  try {
    await assertRejects(
      () =>
        withSpan("op", "test", { k: "v" }, async () => {
          throw "string-failure";
        }),
    );
  } finally {
    if (prev !== undefined) Deno.env.set("SENTRY_DSN", prev);
  }
});

Deno.test("initSentryEdge initializes once then skips re-init", async () => {
  resetSentryEdgeForTests();
  const prev = Deno.env.get("SENTRY_DSN");
  const prevEnv = Deno.env.get("ENVIRONMENT");
  const prevEnvShort = Deno.env.get("ENV");
  Deno.env.set("SENTRY_DSN", "https://examplePublicKey@o0.ingest.sentry.io/0");
  Deno.env.delete("ENVIRONMENT");
  Deno.env.delete("ENV");
  try {
    await initSentryEdge("first-init");
    await initSentryEdge("second-init");
    assertEquals(isSentryEnabled(), true);

    await assertRejects(
      () =>
        withSpan("op", "test", {}, async () => {
          throw new Error("sentry path failure");
        }),
      Error,
      "sentry path failure",
    );
  } finally {
    resetSentryEdgeForTests();
    if (prev === undefined) Deno.env.delete("SENTRY_DSN");
    else Deno.env.set("SENTRY_DSN", prev);
    if (prevEnv === undefined) Deno.env.delete("ENVIRONMENT");
    else Deno.env.set("ENVIRONMENT", prevEnv);
    if (prevEnvShort === undefined) Deno.env.delete("ENV");
    else Deno.env.set("ENV", prevEnvShort);
  }
});

Deno.test("isSentryEnabled treats whitespace-only DSN as disabled", () => {
  resetSentryEdgeForTests();
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.set("SENTRY_DSN", "   ");
  try {
    assertEquals(isSentryEnabled(), false);
  } finally {
    if (prev === undefined) Deno.env.delete("SENTRY_DSN");
    else Deno.env.set("SENTRY_DSN", prev);
  }
});
