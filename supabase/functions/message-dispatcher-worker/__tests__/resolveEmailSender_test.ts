import { assertEquals } from "std/testing/asserts";
import { sendInbucketEmail } from "../../_shared/inbucketEmail.ts";
import { resolveEmailSender } from "../processDispatch.ts";
import { sendResendEmail } from "../resend.ts";

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
