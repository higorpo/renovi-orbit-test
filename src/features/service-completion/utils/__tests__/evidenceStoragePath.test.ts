import { describe, expect, it } from "vitest";
import {
  COMPLETION_EVIDENCE_BUCKET,
  completionEvidenceObjectPath,
  evidenceFileExtension,
} from "../evidenceStoragePath";

describe("evidenceFileExtension", () => {
  it("prefers filename extension", () => {
    expect(evidenceFileExtension("a.PNG", "image/jpeg")).toBe("png");
  });

  it("falls back to mime", () => {
    expect(evidenceFileExtension("blob", "image/webp")).toBe("webp");
  });
});

describe("completionEvidenceObjectPath", () => {
  it("joins prefix with uuid filename", () => {
    expect(
      completionEvidenceObjectPath("cs/sess/", "photo.jpg", "image/jpeg", "abc"),
    ).toBe("cs/sess/abc.jpg");
  });

  it("adds trailing slash when missing", () => {
    expect(
      completionEvidenceObjectPath("cs/sess", "x.webp", "image/webp", "id1"),
    ).toBe("cs/sess/id1.webp");
  });

  it("exports bucket constant", () => {
    expect(COMPLETION_EVIDENCE_BUCKET).toBe("completion-evidence");
  });
});
