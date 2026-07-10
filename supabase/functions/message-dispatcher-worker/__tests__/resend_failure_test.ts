import { assertEquals, assertThrows } from "std/testing/asserts";
import {
  buildResendEmailPayload,
  buildResendFromAddress,
  ResendConfigError,
  sendResendEmail,
} from "../resend.ts";

Deno.test("sendResendEmail throws ResendConfigError when RESEND_API_KEY missing", async () => {
  Deno.env.delete("RESEND_API_KEY");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  try {
    let thrown: Error | undefined;
    try {
      await sendResendEmail({
        recipientEmail: "user@test.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        correlationId: "corr-no-key",
      });
    } catch (err) {
      thrown = err as Error;
    }
    assertEquals(thrown instanceof ResendConfigError, true);
    assertEquals(thrown?.message, "RESEND_API_KEY is required");
  } finally {
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("sendResendEmail maps non-ok HTTP response to failure result", async () => {
  Deno.env.set("RESEND_API_KEY", "re_test");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({ name: "validation_error", message: "Invalid email address" }),
      { status: 422 },
    );

  try {
    const result = await sendResendEmail(
      {
        recipientEmail: "invalid",
        subject: "Hi",
        html: "<p>Hi</p>",
        correlationId: "corr-422",
      },
      { fetchFn: mockFetch, timeoutMs: 5000 },
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.httpStatus, 422);
      assertEquals(result.errorCode, "validation_error");
      assertEquals(result.errorMessage, "Invalid email address");
    }
  } finally {
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("sendResendEmail handles timeout as resend_timeout error code", async () => {
  Deno.env.set("RESEND_API_KEY", "re_test");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const mockFetch: typeof fetch = async () => {
    const err = new DOMException("The operation was aborted", "AbortError");
    throw err;
  };

  try {
    const result = await sendResendEmail(
      {
        recipientEmail: "user@test.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        correlationId: "corr-timeout",
      },
      { fetchFn: mockFetch, timeoutMs: 100 },
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.httpStatus, 0);
      assertEquals(result.errorCode, "resend_timeout");
    }
  } finally {
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("sendResendEmail handles generic network error", async () => {
  Deno.env.set("RESEND_API_KEY", "re_test");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const mockFetch: typeof fetch = async () => {
    throw new Error("Network unreachable");
  };

  try {
    const result = await sendResendEmail(
      {
        recipientEmail: "user@test.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        correlationId: "corr-network",
      },
      { fetchFn: mockFetch, timeoutMs: 5000 },
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.httpStatus, 0);
      assertEquals(result.errorCode, "resend_request_failed");
      assertEquals(result.errorMessage, "Network unreachable");
    }
  } finally {
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("sendResendEmail handles 200 response without id field", async () => {
  Deno.env.set("RESEND_API_KEY", "re_test");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({}), { status: 200 });

  try {
    const result = await sendResendEmail(
      {
        recipientEmail: "user@test.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        correlationId: "corr-no-id",
      },
      { fetchFn: mockFetch, timeoutMs: 5000 },
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.httpStatus, 200);
      assertEquals(result.errorCode, "resend_send_failed");
    }
  } finally {
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("buildResendFromAddress throws when RESEND_FROM_EMAIL is empty", () => {
  Deno.env.delete("RESEND_FROM_EMAIL");
  assertThrows(
    () => buildResendFromAddress(),
    ResendConfigError,
    "RESEND_FROM_EMAIL is required",
  );
});

Deno.test("buildResendFromAddress uses default name when RESEND_FROM_NAME unset", () => {
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@app.com");
  Deno.env.delete("RESEND_FROM_NAME");
  try {
    const from = buildResendFromAddress();
    assertEquals(from, "Renovi <noreply@app.com>");
  } finally {
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("buildResendEmailPayload rejects blank recipient email", () => {
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");
  try {
    assertThrows(
      () =>
        buildResendEmailPayload({
          recipientEmail: "   ",
          subject: "Hi",
          html: "<p>Hi</p>",
          correlationId: "corr",
        }),
      Error,
      "recipient_email is required",
    );
  } finally {
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("sendResendEmail treats non-JSON response body as plain message", async () => {
  Deno.env.set("RESEND_API_KEY", "re_test");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const mockFetch: typeof fetch = async () =>
    new Response("plain text failure", { status: 502 });

  try {
    const result = await sendResendEmail(
      {
        recipientEmail: "user@test.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        correlationId: "corr-plain",
      },
      { fetchFn: mockFetch, timeoutMs: 5000 },
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.errorMessage, "plain text failure");
      assertEquals(result.errorCode, "resend_send_failed");
    }
  } finally {
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});