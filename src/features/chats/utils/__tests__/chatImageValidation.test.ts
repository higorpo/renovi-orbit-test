import { describe, expect, it } from "vitest";
import {
  CHAT_MAX_IMAGES,
  normalizeChatImageFile,
  resolveChatImageMimeType,
  validateChatImageFile,
  validateChatImageFiles,
} from "../chatImageValidation";

function makeFile(
  overrides: Partial<File> & { size: number; type: string; name?: string },
): File {
  return {
    name: "photo.jpg",
    ...overrides,
  } as File;
}

describe("resolveChatImageMimeType", () => {
  it("infers mime from extension when file.type is empty", () => {
    expect(
      resolveChatImageMimeType(makeFile({ type: "", size: 100, name: "photo.JPG" })),
    ).toBe("image/jpeg");
  });
});

describe("normalizeChatImageFile", () => {
  it("sets mime type on files missing file.type", () => {
    const normalized = normalizeChatImageFile(
      makeFile({ type: "", size: 100, name: "shot.png" }),
    );
    expect(normalized.type).toBe("image/png");
  });
});

describe("validateChatImageFile", () => {
  it("accepts allowed mime types", () => {
    expect(validateChatImageFile(makeFile({ type: "image/jpeg", size: 100 }))).toBeNull();
  });

  it("accepts jpg extension without mime type", () => {
    expect(
      validateChatImageFile(makeFile({ type: "", size: 100, name: "photo.jpg" })),
    ).toBeNull();
  });

  it("rejects unsupported mime types", () => {
    expect(
      validateChatImageFile(
        makeFile({ type: "image/gif", size: 100, name: "animation.gif" }),
      ),
    ).toMatch(/Formato não permitido/);
  });

  it("rejects files over 5 MB", () => {
    expect(
      validateChatImageFile(makeFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 })),
    ).toMatch(/5 MB/);
  });
});

describe("validateChatImageFiles", () => {
  it("rejects empty selection", () => {
    expect(validateChatImageFiles([])).toMatch(/pelo menos uma/);
  });

  it("rejects more than max images", () => {
    const files = Array.from({ length: CHAT_MAX_IMAGES + 1 }, (_, i) =>
      makeFile({ type: "image/jpeg", size: 100, name: `${i}.jpg` }),
    );
    expect(validateChatImageFiles(files)).toMatch(/no máximo/);
  });
});
