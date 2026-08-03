/**
 * Shared outbound "From" header for Resend and local Inbucket SMTP.
 * Env: RESEND_FROM_EMAIL (required), RESEND_FROM_NAME (optional, default Renovi).
 */

export class EmailFromConfigError extends Error {
  readonly code = "email_from_config_missing";

  constructor(message: string) {
    super(message);
    this.name = "EmailFromConfigError";
  }
}

export function buildOutboundFromAddress(): string {
  const email = Deno.env.get("RESEND_FROM_EMAIL");
  const name = Deno.env.get("RESEND_FROM_NAME") ?? "Renovi";
  if (!email?.trim()) {
    throw new EmailFromConfigError("RESEND_FROM_EMAIL is required");
  }
  return `${name} <${email.trim()}>`;
}
