import { describe, expect, it } from "vitest";
import {
  moderateTextContent,
  moderateTextWithRecentMessages,
} from "../moderateTextContent";

describe("contentModeration", () => {
  describe("profanity", () => {
    it.each(["porra", "PORRA", "p0rr4", "caralho", "caralhoooo"])(
      "blocks profanity: %s",
      (text) => {
        const result = moderateTextContent(text);
        expect(result.allowed).toBe(false);
        expect(result.violation).toBe("profanity");
        expect(result.message).toBeTruthy();
      },
    );
  });

  describe("phone in single message", () => {
    it.each([
      "48996453859",
      "996453859",
      "9 9 6 4 5 3 8 5 9",
      "9 nove 6 4 cinco 3 8 5 nove",
      "nove nove seis quatro cinco tres oito cinco nove",
      "(48) 99645-3859",
      "meu zap 48996453859",
    ])("blocks phone patterns: %s", (text) => {
      const result = moderateTextContent(text);
      expect(result.allowed).toBe(false);
      expect(result.violation).toBe("phone");
    });
  });

  describe("phone split across recent messages", () => {
    it("blocks when recent user messages reconstruct a mobile number", () => {
      const history = ["9", "996", "oi", "453"];
      const result = moderateTextWithRecentMessages("859", history);

      expect(result.allowed).toBe(false);
      expect(result.violation).toBe("phone");
    });

    it("allows benign short numeric fragments without completing a phone", () => {
      const result = moderateTextWithRecentMessages("42", ["7", "oi"]);
      expect(result.allowed).toBe(true);
    });
  });

  describe("allowed content", () => {
    it("allows normal service messages", () => {
      const result = moderateTextContent(
        "Posso ir amanhã às 14h para avaliar o serviço no local.",
      );
      expect(result.allowed).toBe(true);
    });
  });
});
