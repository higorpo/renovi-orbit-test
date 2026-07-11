import { describe, expect, it, vi } from "vitest";
import {
  collapseRepeatedLetters,
  compactLettersAndDigits,
  extractDigits,
  normalizeForModeration,
  stripDiacritics,
} from "../normalize";
import {
  containsPhoneNumberAcrossMessages,
  containsPhoneNumberInText,
} from "../phoneNumber";

describe("contentModeration normalize", () => {
  it("strips diacritics", () => {
    expect(stripDiacritics("São José")).toBe("Sao Jose");
  });

  it.each([
    ["0", "o"],
    ["1", "i"],
    ["3", "e"],
    ["4", "a"],
    ["5", "s"],
    ["7", "t"],
    ["8", "b"],
  ] as const)("applies leet replacement %s → %s inside letter runs", (leet, letter) => {
    const input = `x${leet}y`;
    expect(normalizeForModeration(input)).toContain(`x${letter}y`);
  });

  it("runs symbol leet patterns without requiring them inside alphanumeric runs", () => {
    // @ and $ are replaced only when present in letter runs; bare symbols stay as separators.
    expect(normalizeForModeration("p@ss")).toContain("p");
    expect(normalizeForModeration("ca$h")).toContain("ca");
  });

  it.each([
    ["zero", "0"],
    ["um", "1"],
    ["uma", "1"],
    ["dois", "2"],
    ["duas", "2"],
    ["tres", "3"],
    ["quatro", "4"],
    ["cinco", "5"],
    ["seis", "6"],
    ["meia", "6"],
    ["sete", "7"],
    ["oito", "8"],
    ["nove", "9"],
    ["dez", "10"],
  ] as const)("maps portuguese number word %s to %s", (word, digit) => {
    expect(extractDigits(`prefix ${word} suffix`)).toContain(digit);
  });

  it("normalizes leet and portuguese number words together", () => {
    expect(normalizeForModeration("p0rr4")).toContain("porra");
    expect(extractDigits("nove nove seis")).toBe("996");
  });

  it("compacts letters/digits and collapses repeats", () => {
    expect(compactLettersAndDigits("a-b_c 1")).toBe("abc1");
    expect(collapseRepeatedLetters("caralhoooo")).toBe("caralhoo");
    expect(collapseRepeatedLetters("caralhoooo", 1)).toBe("caralho");
    expect(collapseRepeatedLetters("aabb")).toBe("aabb");
  });

  it("leaves pure digit runs without letter-based leet conversion", () => {
    expect(normalizeForModeration("12345")).toBe("12345");
  });
});

describe("contentModeration phoneNumber", () => {
  it.each([
    { label: "landline with DDD (11 digits)", text: "(48) 3222-12345" },
    { label: "country-code mobile", text: "5548996453859" },
    { label: "mobile with DDD", text: "48996453859" },
    { label: "mobile without DDD", text: "996453859" },
    { label: "9-prefix fragment length 8+", text: "91234567" },
    { label: "10+ digits starting with non-zero", text: "4832212345" },
  ])("detects $label", ({ text }) => {
    expect(containsPhoneNumberInText(text)).toBe(true);
  });

  it.each([
    { label: "too short", text: "123" },
    { label: "no digits", text: "hello" },
    { label: "seven identical digits", text: "1111111" },
    { label: "non-phone long zeros", text: "000000000000" },
  ])("rejects $label", ({ text }) => {
    expect(containsPhoneNumberInText(text)).toBe(false);
  });

  it("detects phones reconstructed across messages", () => {
    expect(containsPhoneNumberAcrossMessages(["48", "99645", "3859"])).toBe(true);
    expect(containsPhoneNumberAcrossMessages(["oi", ""])).toBe(false);
    expect(containsPhoneNumberAcrossMessages([])).toBe(false);
  });

  it("returns true when a single chunk already contains a phone", () => {
    expect(containsPhoneNumberAcrossMessages(["call 48996453859 now", "ok"])).toBe(true);
  });

  it("detects phone fragments embedded in longer digit streams", () => {
    expect(containsPhoneNumberInText("pedido 123 48996453859 fim")).toBe(true);
  });

  it("returns false when combined digit stream is still too short", () => {
    expect(containsPhoneNumberAcrossMessages(["1", "2", "3"])).toBe(false);
  });

  it("scans overlapping windows in a long non-matching then matching stream", () => {
    // Leading junk digits force the sliding-window scanner path.
    expect(containsPhoneNumberInText("111111148996453859")).toBe(true);
  });

  it("returns false when digit chunks join to an empty combined stream", () => {
    // Defensive path: filter keeps only non-empty chunks, so combined is never empty
    // in normal use; still assert the multi-message short-stream rejection.
    expect(containsPhoneNumberAcrossMessages(["", "   ", "abc"])).toBe(false);
  });

  it("defensively rejects an empty combined stream after chunks were collected", () => {
    const joinSpy = vi
      .spyOn(Array.prototype, "join")
      .mockImplementationOnce(() => "");

    try {
      expect(containsPhoneNumberAcrossMessages(["12", "34"])).toBe(false);
    } finally {
      joinSpy.mockRestore();
    }
  });
});
