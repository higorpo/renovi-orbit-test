// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  convertHeicChatImageToJpeg,
  isHeicOrHeifChatImage,
  prepareWebChatImageFile,
  sniffHeicOrHeifContent,
} from "../chatImagePrepare";

vi.mock("heic2any", () => ({
  default: vi.fn(async () => new Blob(["jpeg-bytes"], { type: "image/jpeg" })),
}));

describe("isHeicOrHeifChatImage", () => {
  it("detects HEIC by mime type", () => {
    const file = { name: "photo.heic", type: "image/heic", size: 100 } as File;
    expect(isHeicOrHeifChatImage(file)).toBe(true);
  });

  it("detects HEIF by extension when mime is empty", () => {
    const file = { name: "photo.heif", type: "", size: 100 } as File;
    expect(isHeicOrHeifChatImage(file)).toBe(true);
  });

  it("returns false for JPEG", () => {
    const file = { name: "photo.jpg", type: "image/jpeg", size: 100 } as File;
    expect(isHeicOrHeifChatImage(file)).toBe(false);
  });
});

describe("convertHeicChatImageToJpeg", () => {
  it("returns a JPEG file with .jpg extension", async () => {
    const file = { name: "IMG_1234.HEIC", type: "image/heic", size: 100 } as File;
    const converted = await convertHeicChatImageToJpeg(file);

    expect(converted.type).toBe("image/jpeg");
    expect(converted.name).toBe("IMG_1234.jpg");
  });
});

describe("sniffHeicOrHeifContent", () => {
  it("detects HEIC from file header even when mime is wrong", async () => {
    const bytes = new Uint8Array(16);
    bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const file = new File([bytes], "photo.jpg", { type: "image/jpeg" });

    expect(await sniffHeicOrHeifContent(file)).toBe(true);
  });
});

describe("prepareWebChatImageFile", () => {
  it("converts HEIC files to JPEG", async () => {
    const file = { name: "shot.heic", type: "image/heic", size: 100 } as File;
    const prepared = await prepareWebChatImageFile(file);

    expect(prepared.type).toBe("image/jpeg");
    expect(prepared.name).toBe("shot.jpg");
  });

  it("passes through non-HEIC files unchanged", async () => {
    const file = new File(["png"], "shot.png", { type: "image/png" });
    const prepared = await prepareWebChatImageFile(file);

    expect(prepared).toBe(file);
  });

  it("converts mislabeled HEIC bytes even when mime says jpeg", async () => {
    const bytes = new Uint8Array(16);
    bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const file = new File([bytes], "photo.jpg", { type: "image/jpeg" });
    const prepared = await prepareWebChatImageFile(file);

    expect(prepared.type).toBe("image/jpeg");
    expect(prepared.name).toBe("photo.jpg");
  });
});
