import { assertEquals, assertThrows } from "std/testing/asserts";
import {
  buildSmtpMessage,
  formatSmtpPayload,
  InbucketConfigError,
  resolveSmtpConfig,
  sendInbucketEmail,
  type InbucketSmtpDeps,
} from "../inbucketEmail.ts";
import { resolveEmailSender } from "../processDispatch.ts";
import { sendResendEmail } from "../resend.ts";

// --- resolveSmtpConfig ---

Deno.test("resolveSmtpConfig throws when INBUCKET_SMTP_HOST is missing", () => {
  Deno.env.delete("INBUCKET_SMTP_HOST");
  assertThrows(
    () => resolveSmtpConfig(),
    InbucketConfigError,
    "INBUCKET_SMTP_HOST is required",
  );
});

Deno.test("resolveSmtpConfig uses default port when INBUCKET_SMTP_PORT unset", () => {
  Deno.env.set("INBUCKET_SMTP_HOST", "localhost");
  Deno.env.delete("INBUCKET_SMTP_PORT");
  try {
    const config = resolveSmtpConfig();
    assertEquals(config.host, "localhost");
    assertEquals(config.port, 54325);
  } finally {
    Deno.env.delete("INBUCKET_SMTP_HOST");
  }
});

Deno.test("resolveSmtpConfig reads custom port", () => {
  Deno.env.set("INBUCKET_SMTP_HOST", "inbucket");
  Deno.env.set("INBUCKET_SMTP_PORT", "2500");
  try {
    const config = resolveSmtpConfig();
    assertEquals(config.host, "inbucket");
    assertEquals(config.port, 2500);
  } finally {
    Deno.env.delete("INBUCKET_SMTP_HOST");
    Deno.env.delete("INBUCKET_SMTP_PORT");
  }
});

Deno.test("resolveSmtpConfig throws on invalid port", () => {
  Deno.env.set("INBUCKET_SMTP_HOST", "localhost");
  Deno.env.set("INBUCKET_SMTP_PORT", "not-a-number");
  try {
    assertThrows(
      () => resolveSmtpConfig(),
      InbucketConfigError,
      "Invalid INBUCKET_SMTP_PORT",
    );
  } finally {
    Deno.env.delete("INBUCKET_SMTP_HOST");
    Deno.env.delete("INBUCKET_SMTP_PORT");
  }
});

// --- buildSmtpMessage ---

Deno.test("buildSmtpMessage builds message with from address from env", () => {
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@renovi.com.br");
  Deno.env.set("RESEND_FROM_NAME", "Renovi");
  try {
    const msg = buildSmtpMessage({
      recipientEmail: "user@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      correlationId: "corr-123",
    });
    assertEquals(msg.from, "Renovi <noreply@renovi.com.br>");
    assertEquals(msg.to, "user@example.com");
    assertEquals(msg.subject, "Test Subject");
    assertEquals(msg.html, "<p>Hello</p>");
    assertEquals(msg.messageId, "corr-123");
  } finally {
    Deno.env.delete("RESEND_FROM_EMAIL");
    Deno.env.delete("RESEND_FROM_NAME");
  }
});

// --- formatSmtpPayload ---

Deno.test("formatSmtpPayload includes required MIME headers", () => {
  const payload = formatSmtpPayload({
    from: "Renovi <noreply@renovi.com.br>",
    to: "user@example.com",
    subject: "Welcome",
    html: "<p>Hi</p>",
    messageId: "msg-001",
  });

  assertEquals(payload.includes("From: Renovi <noreply@renovi.com.br>"), true);
  assertEquals(payload.includes("To: user@example.com"), true);
  assertEquals(payload.includes("Subject: Welcome"), true);
  assertEquals(payload.includes("Message-ID: <msg-001@orbit.local>"), true);
  assertEquals(payload.includes("MIME-Version: 1.0"), true);
  assertEquals(payload.includes("Content-Type: text/html; charset=UTF-8"), true);
  assertEquals(payload.includes("<p>Hi</p>"), true);
});

Deno.test("formatSmtpPayload uses CRLF line endings", () => {
  const payload = formatSmtpPayload({
    from: "Test <t@t.com>",
    to: "u@u.com",
    subject: "S",
    html: "<b>B</b>",
    messageId: "m",
  });
  const lines = payload.split("\r\n");
  assertEquals(lines.length >= 7, true);
});

// --- sendInbucketEmail ---

function createMockConn(
  responses: string[],
): { conn: Deno.TcpConn; written: string[]; deps: InbucketSmtpDeps } {
  const written: string[] = [];
  let responseIdx = 0;

  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (responseIdx < responses.length) {
        controller.enqueue(encoder.encode(responses[responseIdx++] + "\r\n"));
      } else {
        controller.close();
      }
    },
  });

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      written.push(new TextDecoder().decode(chunk));
    },
  });

  const conn = {
    readable,
    writable,
    close() {},
    localAddr: { transport: "tcp" as const, hostname: "127.0.0.1", port: 0 },
    remoteAddr: { transport: "tcp" as const, hostname: "127.0.0.1", port: 1025 },
    ref() {},
    unref() {},
    closeWrite() { return Promise.resolve(); },
    setNoDelay(_noDelay?: boolean) {},
    setKeepAlive(_keepAlive?: boolean) {},
    [Symbol.dispose]() {},
  } as unknown as Deno.TcpConn;

  const deps: InbucketSmtpDeps = {
    connect: () => Promise.resolve(conn),
  };

  return { conn, written, deps };
}

Deno.test("sendInbucketEmail succeeds with valid SMTP conversation", async () => {
  Deno.env.set("INBUCKET_SMTP_HOST", "localhost");
  Deno.env.set("INBUCKET_SMTP_PORT", "1025");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");
  Deno.env.set("RESEND_FROM_NAME", "Test");

  const { deps, written } = createMockConn([
    "220 Inbucket ready",
    "250 Hello",
    "250 Sender ok",
    "250 Recipient ok",
    "354 Go ahead",
    "250 Message accepted",
    "221 Bye",
  ]);

  try {
    const result = await sendInbucketEmail(
      {
        recipientEmail: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        correlationId: "corr-smtp-ok",
      },
      deps,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.vendorMessageId, "inbucket-corr-smtp-ok");
      assertEquals(result.httpStatus, 200);
    }

    const allWritten = written.join("");
    assertEquals(allWritten.includes("HELO orbit-worker"), true);
    assertEquals(allWritten.includes("MAIL FROM:<noreply@test.com>"), true);
    assertEquals(allWritten.includes("RCPT TO:<user@example.com>"), true);
    assertEquals(allWritten.includes("DATA"), true);
    assertEquals(allWritten.includes("Subject: Test"), true);
  } finally {
    Deno.env.delete("INBUCKET_SMTP_HOST");
    Deno.env.delete("INBUCKET_SMTP_PORT");
    Deno.env.delete("RESEND_FROM_EMAIL");
    Deno.env.delete("RESEND_FROM_NAME");
  }
});

Deno.test("sendInbucketEmail returns failure on bad greeting", async () => {
  Deno.env.set("INBUCKET_SMTP_HOST", "localhost");
  Deno.env.set("INBUCKET_SMTP_PORT", "1025");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const { deps } = createMockConn(["421 Service not available"]);

  try {
    const result = await sendInbucketEmail(
      {
        recipientEmail: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        correlationId: "corr-bad-greeting",
      },
      deps,
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.errorCode, "inbucket_smtp_error");
      assertEquals(
        result.errorMessage.includes("Unexpected greeting"),
        true,
      );
    }
  } finally {
    Deno.env.delete("INBUCKET_SMTP_HOST");
    Deno.env.delete("INBUCKET_SMTP_PORT");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("sendInbucketEmail returns failure on RCPT TO rejection", async () => {
  Deno.env.set("INBUCKET_SMTP_HOST", "localhost");
  Deno.env.set("INBUCKET_SMTP_PORT", "1025");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const { deps } = createMockConn([
    "220 Ready",
    "250 Hello",
    "250 Sender ok",
    "550 Recipient rejected",
  ]);

  try {
    const result = await sendInbucketEmail(
      {
        recipientEmail: "bad@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        correlationId: "corr-rcpt-fail",
      },
      deps,
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.errorCode, "inbucket_smtp_error");
      assertEquals(result.errorMessage.includes("RCPT TO rejected"), true);
    }
  } finally {
    Deno.env.delete("INBUCKET_SMTP_HOST");
    Deno.env.delete("INBUCKET_SMTP_PORT");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

Deno.test("sendInbucketEmail returns failure on connect error", async () => {
  Deno.env.set("INBUCKET_SMTP_HOST", "localhost");
  Deno.env.set("INBUCKET_SMTP_PORT", "1025");
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@test.com");

  const deps: InbucketSmtpDeps = {
    connect: () => Promise.reject(new Error("Connection refused")),
  };

  try {
    const result = await sendInbucketEmail(
      {
        recipientEmail: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        correlationId: "corr-conn-fail",
      },
      deps,
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.errorCode, "inbucket_smtp_error");
      assertEquals(result.errorMessage, "Connection refused");
    }
  } finally {
    Deno.env.delete("INBUCKET_SMTP_HOST");
    Deno.env.delete("INBUCKET_SMTP_PORT");
    Deno.env.delete("RESEND_FROM_EMAIL");
  }
});

// --- resolveEmailSender ---

Deno.test("resolveEmailSender returns sendInbucketEmail when INBUCKET_SMTP_HOST is set", () => {
  Deno.env.set("INBUCKET_SMTP_HOST", "localhost");
  try {
    const sender = resolveEmailSender();
    assertEquals(sender, sendInbucketEmail);
  } finally {
    Deno.env.delete("INBUCKET_SMTP_HOST");
  }
});

Deno.test("resolveEmailSender returns sendResendEmail when INBUCKET_SMTP_HOST is not set", () => {
  Deno.env.delete("INBUCKET_SMTP_HOST");
  const sender = resolveEmailSender();
  assertEquals(sender, sendResendEmail);
});
