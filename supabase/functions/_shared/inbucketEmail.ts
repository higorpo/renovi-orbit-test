/**
 * Minimal SMTP client for routing emails to the local Inbucket (Mailpit)
 * during development. Uses raw TCP via Deno.connect — no TLS, no auth.
 *
 * Env: INBUCKET_SMTP_HOST, INBUCKET_SMTP_PORT.
 * Consumers: message-dispatcher-worker, dispatch-kyc-email.
 */

import { buildOutboundFromAddress } from "./emailFrom.ts";

const DEFAULT_SMTP_PORT = 54325;
const SMTP_CONNECT_TIMEOUT_MS = 5_000;

export class InbucketConfigError extends Error {
  readonly code = "inbucket_config_missing";

  constructor(message: string) {
    super(message);
    this.name = "InbucketConfigError";
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
}

export function resolveSmtpConfig(): SmtpConfig {
  const host = Deno.env.get("INBUCKET_SMTP_HOST");
  if (!host?.trim()) {
    throw new InbucketConfigError("INBUCKET_SMTP_HOST is required");
  }
  const portRaw = Deno.env.get("INBUCKET_SMTP_PORT");
  const port = portRaw ? Number(portRaw) : DEFAULT_SMTP_PORT;
  if (Number.isNaN(port) || port <= 0) {
    throw new InbucketConfigError(`Invalid INBUCKET_SMTP_PORT: ${portRaw}`);
  }
  return { host: host.trim(), port };
}

/** True when local SMTP (Mailpit/Inbucket) should replace Resend. */
export function shouldUseInbucketEmail(): boolean {
  return Boolean(Deno.env.get("INBUCKET_SMTP_HOST")?.trim());
}

export type InbucketAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
};

export type SendInbucketEmailInput = {
  recipientEmail: string;
  subject: string;
  html: string;
  correlationId: string;
  attachments?: InbucketAttachment[];
};

export type InbucketSendResult =
  | { ok: true; vendorMessageId: string; httpStatus: number }
  | { ok: false; httpStatus: number; errorCode: string; errorMessage: string };

export interface SmtpMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  messageId: string;
  attachments: InbucketAttachment[];
}

export function contentTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".heif")) return "image/heif";
  return "application/octet-stream";
}

export function wrapBase64(contentBase64: string, lineLength = 76): string {
  const cleaned = contentBase64.replace(/\s+/g, "");
  const lines: string[] = [];
  for (let i = 0; i < cleaned.length; i += lineLength) {
    lines.push(cleaned.slice(i, i + lineLength));
  }
  return lines.join("\r\n");
}

export function buildSmtpMessage(input: SendInbucketEmailInput): SmtpMessage {
  return {
    from: buildOutboundFromAddress(),
    to: input.recipientEmail.trim(),
    subject: input.subject,
    html: input.html,
    messageId: input.correlationId,
    attachments: input.attachments ?? [],
  };
}

export function formatSmtpPayload(msg: SmtpMessage): string {
  const headers = [
    `From: ${msg.from}`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    `Message-ID: <${msg.messageId}@orbit.local>`,
    "MIME-Version: 1.0",
  ];

  if (msg.attachments.length === 0) {
    return [
      ...headers,
      "Content-Type: text/html; charset=UTF-8",
      "",
      msg.html,
    ].join("\r\n");
  }

  const boundary = `----=_OrbitBoundary_${msg.messageId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const parts: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    msg.html,
  ];

  for (const attachment of msg.attachments) {
    const filename = attachment.filename.trim() || "document.bin";
    const contentType = attachment.contentType
      ?? contentTypeForFilename(filename);
    parts.push(
      `--${boundary}`,
      `Content-Type: ${contentType}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      wrapBase64(attachment.contentBase64),
    );
  }

  parts.push(`--${boundary}--`, "");
  return parts.join("\r\n");
}

function extractEmailAddress(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return match ? match[1] : addr;
}

async function readSmtpReply(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
): Promise<{ code: number; text: string }> {
  const { value, done } = await reader.read();
  if (done || !value) {
    return { code: 0, text: "" };
  }
  const text = decoder.decode(value).trim();
  const code = parseInt(text.substring(0, 3), 10);
  return { code: Number.isNaN(code) ? 0 : code, text };
}

async function writeSmtpLine(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  line: string,
): Promise<void> {
  await writer.write(encoder.encode(line + "\r\n"));
}

export interface InbucketSmtpDeps {
  connect: (opts: Deno.ConnectOptions) => Promise<Deno.TcpConn>;
}

const defaultDeps: InbucketSmtpDeps = {
  connect: (opts) => Deno.connect(opts),
};

export async function sendInbucketEmail(
  input: SendInbucketEmailInput,
  deps: InbucketSmtpDeps = defaultDeps,
): Promise<InbucketSendResult> {
  const config = resolveSmtpConfig();
  const msg = buildSmtpMessage(input);
  const payload = formatSmtpPayload(msg);

  let conn: Deno.TcpConn | null = null;

  try {
    conn = await Promise.race([
      deps.connect({ hostname: config.host, port: config.port }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("SMTP connect timeout")),
          SMTP_CONNECT_TIMEOUT_MS,
        )
      ),
    ]);

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = conn.readable.getReader();
    const writer = conn.writable.getWriter();

    const greeting = await readSmtpReply(reader, decoder);
    if (greeting.code !== 220) {
      return smtpFailure(`Unexpected greeting: ${greeting.text}`);
    }

    await writeSmtpLine(writer, encoder, "HELO orbit-worker");
    const helo = await readSmtpReply(reader, decoder);
    if (helo.code !== 250) {
      return smtpFailure(`HELO rejected: ${helo.text}`);
    }

    await writeSmtpLine(
      writer,
      encoder,
      `MAIL FROM:<${extractEmailAddress(msg.from)}>`,
    );
    const mailFrom = await readSmtpReply(reader, decoder);
    if (mailFrom.code !== 250) {
      return smtpFailure(`MAIL FROM rejected: ${mailFrom.text}`);
    }

    await writeSmtpLine(writer, encoder, `RCPT TO:<${msg.to}>`);
    const rcptTo = await readSmtpReply(reader, decoder);
    if (rcptTo.code !== 250) {
      return smtpFailure(`RCPT TO rejected: ${rcptTo.text}`);
    }

    await writeSmtpLine(writer, encoder, "DATA");
    const dataReply = await readSmtpReply(reader, decoder);
    if (dataReply.code !== 354) {
      return smtpFailure(`DATA rejected: ${dataReply.text}`);
    }

    await writeSmtpLine(writer, encoder, payload);
    await writeSmtpLine(writer, encoder, ".");
    const dataEnd = await readSmtpReply(reader, decoder);
    if (dataEnd.code !== 250) {
      return smtpFailure(`Message rejected: ${dataEnd.text}`);
    }

    await writeSmtpLine(writer, encoder, "QUIT");
    reader.releaseLock();
    writer.releaseLock();

    return {
      ok: true,
      vendorMessageId: `inbucket-${msg.messageId}`,
      httpStatus: 200,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return smtpFailure(message);
  } finally {
    try {
      conn?.close();
    } catch {
      // already closed
    }
  }
}

function smtpFailure(errorMessage: string): InbucketSendResult {
  return {
    ok: false,
    httpStatus: 0,
    errorCode: "inbucket_smtp_error",
    errorMessage,
  };
}
