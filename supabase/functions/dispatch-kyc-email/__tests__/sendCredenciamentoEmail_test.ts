import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_NETCRED_CREDENCIAMENTO_EMAIL,
  NETCRED_CREDENCIAMENTO_EMAIL_ENV,
  resolveCredenciamentoRecipientEmail,
  sendCredenciamentoEmail,
} from "../sendCredenciamentoEmail.ts";

Deno.test("DEFAULT_NETCRED_CREDENCIAMENTO_EMAIL is Renovi inbox", () => {
  assertEquals(
    DEFAULT_NETCRED_CREDENCIAMENTO_EMAIL,
    "credenciamento@renovi.com.br",
  );
});

Deno.test("resolveCredenciamentoRecipientEmail falls back to Renovi default", () => {
  const previous = Deno.env.get(NETCRED_CREDENCIAMENTO_EMAIL_ENV);
  Deno.env.delete(NETCRED_CREDENCIAMENTO_EMAIL_ENV);
  try {
    assertEquals(
      resolveCredenciamentoRecipientEmail(),
      "credenciamento@renovi.com.br",
    );
  } finally {
    if (previous === undefined) {
      Deno.env.delete(NETCRED_CREDENCIAMENTO_EMAIL_ENV);
    } else {
      Deno.env.set(NETCRED_CREDENCIAMENTO_EMAIL_ENV, previous);
    }
  }
});

Deno.test("sendCredenciamentoEmail routes to Inbucket when INBUCKET_SMTP_HOST is set", async () => {
  const previousHost = Deno.env.get("INBUCKET_SMTP_HOST");
  const previousFrom = Deno.env.get("RESEND_FROM_EMAIL");
  Deno.env.set("INBUCKET_SMTP_HOST", "127.0.0.1");
  Deno.env.set("INBUCKET_SMTP_PORT", "9"); // closed port → SMTP failure, proves Inbucket path
  Deno.env.set("RESEND_FROM_EMAIL", "noreply@renovi.com.br");
  Deno.env.delete("RESEND_API_KEY");

  try {
    const result = await sendCredenciamentoEmail({
      recipientEmail: "credenciamento@renovi.com.br",
      subject: "KYC test",
      html: "<p>test</p>",
      attachments: [{ filename: "doc.pdf", contentBase64: btoa("pdf") }],
      correlationId: "kyc-inbucket-route",
    });

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.errorCode, "inbucket_smtp_error");
    }
  } finally {
    if (previousHost === undefined) {
      Deno.env.delete("INBUCKET_SMTP_HOST");
    } else {
      Deno.env.set("INBUCKET_SMTP_HOST", previousHost);
    }
    Deno.env.delete("INBUCKET_SMTP_PORT");
    if (previousFrom === undefined) {
      Deno.env.delete("RESEND_FROM_EMAIL");
    } else {
      Deno.env.set("RESEND_FROM_EMAIL", previousFrom);
    }
  }
});
