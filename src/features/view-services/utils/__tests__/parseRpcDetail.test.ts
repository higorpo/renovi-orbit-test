import { describe, expect, it } from "vitest";
import { extractRpcErrorCode, parseRpcDetailObject } from "../parseRpcDetail";

describe("parseRpcDetailObject", () => {
  it("returns null for missing details", () => {
    expect(parseRpcDetailObject(undefined)).toBeNull();
    expect(parseRpcDetailObject("")).toBeNull();
  });

  it("parses a JSON object", () => {
    expect(parseRpcDetailObject('{"code":"PAYMENT_REQUIRED"}')).toEqual({
      code: "PAYMENT_REQUIRED",
    });
  });

  it("returns null for non-object JSON", () => {
    expect(parseRpcDetailObject('"string"')).toBeNull();
    expect(parseRpcDetailObject("[1,2]")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseRpcDetailObject("{not-json")).toBeNull();
  });
});

describe("extractRpcErrorCode", () => {
  it("prefers code from details JSON", () => {
    expect(
      extractRpcErrorCode({
        message: "fallback",
        details: '{"code":"SERVICE_NOT_READY"}',
      }),
    ).toBe("SERVICE_NOT_READY");
  });

  it("falls back to error message when details have no code", () => {
    expect(
      extractRpcErrorCode({
        message: "raw message",
        details: '{"other":true}',
      }),
    ).toBe("raw message");
  });

  it("falls back to message when details are missing", () => {
    expect(extractRpcErrorCode({ message: "only-message" })).toBe("only-message");
  });
});
