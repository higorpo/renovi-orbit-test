import { assertEquals, assertRejects } from "std/testing/asserts";
import {
  setGatewaySpanRecorderForTests,
  withGatewaySpan,
  type GatewaySpanRecord,
} from "../gateway-spans.ts";

Deno.test("withGatewaySpan records success outcome and attributes", async () => {
  const records: GatewaySpanRecord[] = [];
  setGatewaySpanRecorderForTests((record) => records.push(record));

  try {
    const value = await withGatewaySpan(
      "charge",
      "netcred",
      async () => ({ id: "tx-1" }),
      (result) => ({ transaction_id: result.id }),
    );

    assertEquals(value, { id: "tx-1" });
    assertEquals(records.length, 1);
    assertEquals(records[0]?.operation, "charge");
    assertEquals(records[0]?.gateway_slug, "netcred");
    assertEquals(records[0]?.outcome, "success");
    assertEquals(records[0]?.attributes.transaction_id, "tx-1");
  } finally {
    setGatewaySpanRecorderForTests(null);
  }
});

Deno.test("withGatewaySpan maps gateway_error outcome from attributes", async () => {
  const records: GatewaySpanRecord[] = [];
  setGatewaySpanRecorderForTests((record) => records.push(record));

  try {
    await withGatewaySpan(
      "charge",
      "netcred",
      async () => ({ declined: true }),
      () => ({ outcome: "gateway_error" }),
    );

    assertEquals(records[0]?.outcome, "gateway_error");
  } finally {
    setGatewaySpanRecorderForTests(null);
  }
});

Deno.test("withGatewaySpan records error outcome and rethrows", async () => {
  const records: GatewaySpanRecord[] = [];
  setGatewaySpanRecorderForTests((record) => records.push(record));

  try {
    await assertRejects(
      () =>
        withGatewaySpan("charge", "netcred", async () => {
          throw new Error("gateway down");
        }),
      Error,
      "gateway down",
    );

    assertEquals(records.length, 1);
    assertEquals(records[0]?.outcome, "error");
    assertEquals(records[0]?.attributes.error_message, "gateway down");
  } finally {
    setGatewaySpanRecorderForTests(null);
  }
});

Deno.test("withGatewaySpan stringifies non-Error throw values", async () => {
  const records: GatewaySpanRecord[] = [];
  setGatewaySpanRecorderForTests((record) => records.push(record));

  try {
    await assertRejects(
      () =>
        withGatewaySpan("charge", "netcred", async () => {
          throw "gateway string failure";
        }),
    );
    assertEquals(records[0]?.attributes.error_message, "gateway string failure");
  } finally {
    setGatewaySpanRecorderForTests(null);
  }
});

Deno.test("withGatewaySpan success without mapAttributes still records outcome", async () => {
  const records: GatewaySpanRecord[] = [];
  setGatewaySpanRecorderForTests((record) => records.push(record));

  try {
    const value = await withGatewaySpan("tokenAuth", "netcred", async () => "ok");
    assertEquals(value, "ok");
    assertEquals(records[0]?.outcome, "success");
    assertEquals(records[0]?.attributes.operation, "tokenAuth");
  } finally {
    setGatewaySpanRecorderForTests(null);
  }
});
