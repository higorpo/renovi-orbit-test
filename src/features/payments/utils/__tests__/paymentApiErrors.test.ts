import { describe, expect, it } from "vitest";
import { mapPaymentRpcError, parsePaymentRpcDetailObject } from "../paymentApiErrors";

describe("parsePaymentRpcDetailObject", () => {
  it("returns null for missing, invalid, or non-object JSON", () => {
    expect(parsePaymentRpcDetailObject(undefined)).toBeNull();
    expect(parsePaymentRpcDetailObject("not-json")).toBeNull();
    expect(parsePaymentRpcDetailObject("[1,2]")).toBeNull();
    expect(parsePaymentRpcDetailObject("null")).toBeNull();
  });

  it("parses object JSON payloads", () => {
    expect(parsePaymentRpcDetailObject('{"code":"RATE_LIMIT"}')).toEqual({
      code: "RATE_LIMIT",
    });
  });
});

describe("mapPaymentRpcError", () => {
  it("prefers detail code over error.code and message", () => {
    expect(
      mapPaymentRpcError({
        message: "fallback",
        code: "RPC_CODE",
        details: JSON.stringify({ code: "DETAIL_CODE" }),
      }).code,
    ).toBe("DETAIL_CODE");
  });

  it("falls back to error.code then message", () => {
    expect(mapPaymentRpcError({ message: "msg", code: "RPC_CODE" }).code).toBe("RPC_CODE");
    expect(mapPaymentRpcError({ message: "msg" }).code).toBe("msg");
  });

  it("parses retry_after_seconds from number or numeric string", () => {
    expect(
      mapPaymentRpcError({
        message: "wait",
        details: JSON.stringify({ retry_after_seconds: 30 }),
      }).retryAfterSeconds,
    ).toBe(30);

    expect(
      mapPaymentRpcError({
        message: "wait",
        details: JSON.stringify({ retry_after_seconds: "45" }),
      }).retryAfterSeconds,
    ).toBe(45);

    expect(
      mapPaymentRpcError({
        message: "wait",
        details: JSON.stringify({ retry_after_seconds: "nope" }),
      }).retryAfterSeconds,
    ).toBeUndefined();
  });

  it("uses default message when error.message is empty", () => {
    expect(mapPaymentRpcError({ message: "" }).message).toBe(
      "Não foi possível concluir a operação.",
    );
  });
});
