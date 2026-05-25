/**
 * Minimal SMTP client for routing emails to the local Inbucket (Mailpit)
 * server during development. Uses raw TCP via Deno.connect — no external
 * dependencies, no TLS, no auth (Inbucket accepts everything).
 *
 * Env vars: INBUCKET_SMTP_HOST, INBUCKET_SMTP_PORT.
 */

import {
  buildResendFromAddress,
  type ResendSendResult,
  type SendResendEmailInput,
} from "./resend.ts";

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

export interface SmtpMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  messageId: string;
}

export function buildSmtpMessage(input: SendResendEmailInput): SmtpMessage {
  const from = buildResendFromAddress();
  const to = input.recipientEmail.trim();
  const messageId = input.correlationId;

  return { from, to, subject: input.subject, html: input.html, messageId };
}

export function formatSmtpPayload(msg: SmtpMessage): string {
  const lines = [
    `From: ${msg.from}`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    `Message-ID: <${msg.messageId}@orbit.local>`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    msg.html,
  ];
  return lines.join("\r\n");
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
  input: SendResendEmailInput,
  deps: InbucketSmtpDeps = defaultDeps,
): Promise<ResendSendResult> {
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

function smtpFailure(errorMessage: string): ResendSendResult {
  return {
    ok: false,
    httpStatus: 0,
    errorCode: "inbucket_smtp_error",
    errorMessage,
  };
}
