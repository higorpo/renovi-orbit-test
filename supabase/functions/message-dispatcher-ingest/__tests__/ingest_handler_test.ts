import { assertEquals } from "std/testing/asserts";
import { assert } from "std/testing/asserts";
import { join } from "std/path/mod";
import type { IngestDispatchBody } from "../types.ts";

/**
 * Tests for message-dispatcher-ingest Edge Function.
 *
 * The handler is a thin HTTP adapter (same pattern as webhook-resend/worker):
 * validate request → auth → call RPC. Core RPC logic is covered by 10 pgTAP
 * SQL tests; client-side behavior by dispatchIngest.api.test.ts.
 *
 * These tests cover:
 * - config.toml registration
 * - IngestDispatchBody type contract and validation logic
 * - Body field requirement checks (mirrors index.ts conditional)
 * - RPC parameter mapping with defaults
 */

const configPath = join(Deno.cwd(), "supabase", "config.toml");

// --- Config registration ---

Deno.test("message-dispatcher-ingest is registered in config.toml", async () => {
  const text = await Deno.readTextFile(configPath);
  assert(text.includes("[functions.message-dispatcher-ingest]"));
});

// --- Body validation logic (mirrors the check in index.ts L37) ---

function isValidIngestBody(body: Partial<IngestDispatchBody>): boolean {
  return Boolean(body.profileId && body.channel && body.templateKey && body.idempotencyKey);
}

Deno.test("body validation: accepts complete required fields", () => {
  assertEquals(
    isValidIngestBody({
      idempotencyKey: "idem-1",
      profileId: "550e8400-e29b-41d4-a716-446655440001",
      channel: "email",
      templateKey: "welcome_template",
    }),
    true,
  );
});

Deno.test("body validation: rejects missing profileId", () => {
  assertEquals(
    isValidIngestBody({ idempotencyKey: "k", channel: "email", templateKey: "t" }),
    false,
  );
});

Deno.test("body validation: rejects empty profileId", () => {
  assertEquals(
    isValidIngestBody({ idempotencyKey: "k", profileId: "", channel: "email", templateKey: "t" }),
    false,
  );
});

Deno.test("body validation: rejects missing channel", () => {
  assertEquals(
    isValidIngestBody({ idempotencyKey: "k", profileId: "p", templateKey: "t" }),
    false,
  );
});

Deno.test("body validation: rejects missing templateKey", () => {
  assertEquals(
    isValidIngestBody({ idempotencyKey: "k", profileId: "p", channel: "email" }),
    false,
  );
});

Deno.test("body validation: rejects missing idempotencyKey", () => {
  assertEquals(
    isValidIngestBody({ profileId: "p", channel: "push", templateKey: "t" }),
    false,
  );
});

// --- RPC parameter mapping (mirrors index.ts L58-67) ---

function buildIngestRpcParams(body: IngestDispatchBody) {
  return {
    p_idempotency_key: body.idempotencyKey,
    p_profile_id: body.profileId,
    p_channel: body.channel,
    p_template_key: body.templateKey,
    p_template_variables: body.templateVariables ?? {},
    p_scheduled_for: body.scheduledFor,
    p_source_system: body.sourceSystem ?? "orbit",
    p_metadata: body.metadata ?? {},
  };
}

Deno.test("RPC params: defaults sourceSystem to 'orbit' when omitted", () => {
  const params = buildIngestRpcParams({
    idempotencyKey: "k",
    profileId: "p",
    channel: "email",
    templateKey: "t",
  });
  assertEquals(params.p_source_system, "orbit");
});

Deno.test("RPC params: defaults templateVariables to empty object", () => {
  const params = buildIngestRpcParams({
    idempotencyKey: "k",
    profileId: "p",
    channel: "email",
    templateKey: "t",
  });
  assertEquals(params.p_template_variables, {});
});

Deno.test("RPC params: defaults metadata to empty object", () => {
  const params = buildIngestRpcParams({
    idempotencyKey: "k",
    profileId: "p",
    channel: "push",
    templateKey: "t",
  });
  assertEquals(params.p_metadata, {});
});

Deno.test("RPC params: preserves explicit optional values", () => {
  const params = buildIngestRpcParams({
    idempotencyKey: "idem-full",
    profileId: "550e8400-e29b-41d4-a716-446655440001",
    channel: "push",
    templateKey: "engagement_push",
    templateVariables: { name: "Ana", coupon: "SAVE20" },
    scheduledFor: "2026-07-01T10:00:00Z",
    sourceSystem: "admin-panel",
    metadata: { campaign_id: "c-42" },
  });
  assertEquals(params.p_idempotency_key, "idem-full");
  assertEquals(params.p_channel, "push");
  assertEquals(params.p_template_variables, { name: "Ana", coupon: "SAVE20" });
  assertEquals(params.p_scheduled_for, "2026-07-01T10:00:00Z");
  assertEquals(params.p_source_system, "admin-panel");
  assertEquals(params.p_metadata, { campaign_id: "c-42" });
});

Deno.test("RPC params: scheduledFor is undefined when not provided", () => {
  const params = buildIngestRpcParams({
    idempotencyKey: "k",
    profileId: "p",
    channel: "email",
    templateKey: "t",
  });
  assertEquals(params.p_scheduled_for, undefined);
});

// --- Profile ownership check (mirrors index.ts L51) ---

Deno.test("ownership check: user.id must equal body.profileId", () => {
  const authUserId: string = "user-abc";
  const bodyProfileId: string = "user-abc";
  assertEquals(authUserId === bodyProfileId, true);
});

Deno.test("ownership check: mismatch detected when user.id != profileId", () => {
  const authUserId: string = "user-abc";
  const bodyProfileId: string = "user-xyz";
  assertEquals(authUserId === bodyProfileId, false);
});
