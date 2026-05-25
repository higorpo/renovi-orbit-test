import { assertEquals } from "std/testing/asserts";
import {
  buildResendEmailPayload,
  buildResendRequestInit,
  sendResendEmail,
} from "../resend.ts";

Deno.test("buildResendRequestInit sets Idempotency-Key to correlation_id", () => {
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");
  Deno.env.set("RESEND_FROM_NAME", "Orbit");

  try {
    const init = buildResendRequestInit(
      {
        recipientEmail: "user@test.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
      },
      "re_test_key",
    );

    assertEquals(
      (init.headers as Record<string, string>)?.["Idempotency-Key"],
      "550e8400-e29b-41d4-a716-446655440000",
    );

    const body = JSON.parse(init.body as string);
    assertEquals(body.to, ["user@test.com"]);
    assertEquals(body.subject, "Hi");
  } finally {
    Deno.env.delete("RESEND_FROM_EMAIL");
    Deno.env.delete("RESEND_FROM_NAME");
  }
});

Deno.test("buildResendEmailPayload uses only recipientEmail for to", () => {
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");
  try {
    const payload = buildResendEmailPayload({
      recipientEmail: "checkout@renovi.com.br",
      subject: "Welcome",
      html: "<p>Welcome</p>",
      correlationId: "corr-1",
    });
    assertEquals(payload.to, ["checkout@renovi.com.br"]);
  } finally {
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("sendResendEmail maps success response id", async () => {
  Deno.env.set("RESEND_API_KEY", "re_test");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ id: "email_abc123" }), { status: 200 });

  try {
    const result = await sendResendEmail(
      {
        recipientEmail: "user@test.com",
        subject: "Hi",
        html: "<p>Hi</p>",
        correlationId: "corr-mock",
      },
      { fetchFn: mockFetch, timeoutMs: 5000 },
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.vendorMessageId, "email_abc123");
      assertEquals(result.httpStatus, 200);
    }
  } finally {
    Deno.env.delete("RESEND_API_KEY");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});
