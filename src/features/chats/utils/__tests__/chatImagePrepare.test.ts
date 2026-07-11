// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  convertHeicChatImageToJpeg,
  createBlobPreviewAttachment,
  ensureChatImageDisplayable,
  fileFromDataUrl,
  isHeicOrHeifChatImage,
  needsHeicConversion,
  prepareChatImageFile,
  prepareChatImageFiles,
  prepareNativeHeicFile,
  prepareWebChatImageFile,
  sniffHeicOrHeifContent,
  verifyImageLoads,
  verifyImageUrlLoads,
} from "../chatImagePrepare";

vi.mock("heic2any", () => ({
  default: vi.fn(async () => new Blob(["jpeg-bytes"], { type: "image/jpeg" })),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

class ControlledImage {
  static latest: ControlledImage | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    ControlledImage.latest = this;
  }

  set src(_value: string) {}
}

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

  it("rejects short and non-HEIC headers", async () => {
    expect(
      await sniffHeicOrHeifContent(new File([new Uint8Array(8)], "short.jpg")),
    ).toBe(false);

    const bytes = new Uint8Array(16);
    bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
    expect(await sniffHeicOrHeifContent(new File([bytes], "avif.jpg"))).toBe(false);
  });
});

describe("image load verification", () => {
  beforeEach(() => {
    ControlledImage.latest = null;
    vi.stubGlobal("Image", ControlledImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("resolves true when a file image loads and revokes its URL", async () => {
    const promise = verifyImageLoads(new File(["x"], "photo.jpg"));
    ControlledImage.latest?.onload?.();

    await expect(promise).resolves.toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("resolves false when a URL image fails", async () => {
    const promise = verifyImageUrlLoads("https://example.com/broken.jpg");
    ControlledImage.latest?.onerror?.();

    await expect(promise).resolves.toBe(false);
  });

  it("times out file image verification", async () => {
    vi.useFakeTimers();
    const promise = verifyImageLoads(new File(["x"], "photo.jpg"), 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe(false);
    vi.useRealTimers();
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

describe("native image preparation", () => {
  it("uses a canvas JPEG when the native web path loads", async () => {
    const originalImage = globalThis.Image;
    class LoadingImage {
      naturalWidth = 100;
      naturalHeight = 50;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }
    globalThis.Image = LoadingImage as unknown as typeof Image;

    const drawImage = vi.fn();
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(canvas, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["jpeg"], { type: "image/jpeg" }));
    });
    vi.spyOn(document, "createElement").mockReturnValue(canvas);

    const result = await prepareNativeHeicFile({
      rawFile: new File(["raw"], "photo.heic", { type: "image/heic" }),
      webPath: "capacitor://photo",
      thumbnailDataUrl: null,
      fileName: "photo.jpg",
    });

    expect(result.name).toBe("photo.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(drawImage).toHaveBeenCalled();
    globalThis.Image = originalImage;
  });

  it("falls back to thumbnail data when no web path is available", async () => {
    const result = await prepareNativeHeicFile({
      rawFile: new File(["raw"], "photo.heic", { type: "image/heic" }),
      webPath: "",
      thumbnailDataUrl: "data:image/png;base64,eA==",
      fileName: "thumb.png",
    });

    expect(result.name).toBe("thumb.png");
    expect(result.type).toBe("image/png");
    expect(result.size).toBe(1);
  });

  it("throws when no native conversion source can be used", async () => {
    await expect(
      prepareNativeHeicFile({
        rawFile: new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }),
        webPath: "",
        thumbnailDataUrl: null,
        fileName: "photo.jpg",
      }),
    ).rejects.toThrow("NATIVE_HEIC_PREPARE_FAILED");
  });

  it("falls back to heic2any when canvas conversion fails for HEIC bytes", async () => {
    const originalImage = globalThis.Image;
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onerror?.();
      }
    }
    globalThis.Image = FailingImage as unknown as typeof Image;

    const bytes = new Uint8Array(16);
    bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const rawFile = new File([bytes], "photo.heic", { type: "image/heic" });

    const result = await prepareNativeHeicFile({
      rawFile,
      webPath: "capacitor://broken",
      thumbnailDataUrl: null,
      fileName: "photo.jpg",
    });

    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("photo.jpg");
    globalThis.Image = originalImage;
  });

  it("returns null from canvas conversion when 2d context is unavailable", async () => {
    const originalImage = globalThis.Image;
    class LoadingImage {
      naturalWidth = 10;
      naturalHeight = 10;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    globalThis.Image = LoadingImage as unknown as typeof Image;
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    vi.spyOn(document, "createElement").mockReturnValue(canvas);

    await expect(
      prepareNativeHeicFile({
        rawFile: new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }),
        webPath: "capacitor://photo",
        thumbnailDataUrl: null,
        fileName: "photo.jpg",
      }),
    ).rejects.toThrow("NATIVE_HEIC_PREPARE_FAILED");

    globalThis.Image = originalImage;
  });
});

describe("image preparation helpers", () => {
  it("detects declared HEIC before reading content", async () => {
    const file = new File(["raw"], "photo.heic", { type: "image/heic" });
    await expect(needsHeicConversion(file)).resolves.toBe(true);
  });

  it("prepares arrays and deprecated single-file aliases", async () => {
    const file = new File(["png"], "photo.png", { type: "image/png" });

    await expect(prepareChatImageFiles([file])).resolves.toEqual([file]);
    await expect(prepareChatImageFile(file)).resolves.toBe(file);
    await expect(ensureChatImageDisplayable(file)).resolves.toBe(file);
  });

  it("creates data URL files and revocable blob previews", () => {
    const dataFile = fileFromDataUrl("data:image/png;base64,eA==", "photo.png");
    expect(dataFile).toMatchObject({ name: "photo.png", type: "image/png", size: 1 });

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
    const attachment = createBlobPreviewAttachment(dataFile);
    expect(attachment).toEqual({
      file: dataFile,
      previewUrl: "blob:photo",
      revokePreviewOnCleanup: true,
    });
  });

  it("defaults mime to image/jpeg when data URL header is missing", () => {
    const file = fileFromDataUrl("eA==", "photo.jpg");
    expect(file.type).toBe("image/jpeg");
  });
});

describe("verifyImageLoads remaining branches", () => {
  beforeEach(() => {
    ControlledImage.latest = null;
    vi.stubGlobal("Image", ControlledImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("resolves false on file image error", async () => {
    const promise = verifyImageLoads(new File(["x"], "photo.jpg"));
    ControlledImage.latest?.onerror?.();
    await expect(promise).resolves.toBe(false);
  });

  it("resolves false on timeout", async () => {
    vi.useFakeTimers();
    const promise = verifyImageLoads(new File(["x"], "photo.jpg"), 50);
    await vi.advanceTimersByTimeAsync(60);
    await expect(promise).resolves.toBe(false);
    vi.useRealTimers();
  });

  it("ignores duplicate finish callbacks after load", async () => {
    const promise = verifyImageLoads(new File(["x"], "photo.jpg"));
    ControlledImage.latest?.onload?.();
    ControlledImage.latest?.onerror?.();
    await expect(promise).resolves.toBe(true);
  });

  it("resolves true when a URL image loads", async () => {
    const promise = verifyImageUrlLoads("https://example.com/ok.jpg");
    ControlledImage.latest?.onload?.();
    await expect(promise).resolves.toBe(true);
  });

  it("resolves false when URL image times out", async () => {
    vi.useFakeTimers();
    const promise = verifyImageUrlLoads("https://example.com/slow.jpg", 40);
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).resolves.toBe(false);
    vi.useRealTimers();
  });

  it("ignores duplicate finish callbacks for URL image verification", async () => {
    const promise = verifyImageUrlLoads("https://example.com/ok.jpg");
    ControlledImage.latest?.onload?.();
    ControlledImage.latest?.onerror?.();
    await expect(promise).resolves.toBe(true);
  });
});

describe("convertImageUrlToJpegFile null blob", () => {
  it("falls back to heic2any when canvas toBlob returns null", async () => {
    const originalImage = globalThis.Image;
    class LoadingImage {
      naturalWidth = 8;
      naturalHeight = 8;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    globalThis.Image = LoadingImage as unknown as typeof Image;
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(canvas, "toBlob").mockImplementation((callback) => {
      callback(null);
    });
    vi.spyOn(document, "createElement").mockReturnValue(canvas);

    const bytes = new Uint8Array(16);
    bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const result = await prepareNativeHeicFile({
      rawFile: new File([bytes], "photo.heic", { type: "image/heic" }),
      webPath: "capacitor://photo",
      thumbnailDataUrl: null,
      fileName: "from-null-blob.jpg",
    });

    expect(result.name).toBe("photo.jpg");
    expect(result.type).toBe("image/jpeg");
    globalThis.Image = originalImage;
  });
});

describe("sniffHeicOrHeifContent brand variants", () => {
  it.each(["heic", "heix", "hevc", "hevx", "mif1", "msf1"] as const)(
    "detects brand %s",
    async (brand) => {
      const bytes = new Uint8Array(16);
      bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
      for (let i = 0; i < 4; i++) bytes[8 + i] = brand.charCodeAt(i);
      expect(await sniffHeicOrHeifContent(new File([bytes], "photo.bin"))).toBe(true);
    },
  );

  it("rejects when ftyp marker is missing", async () => {
    const bytes = new Uint8Array(16);
    bytes.set([0x00, 0x00, 0x00, 0x18, 0x00, 0x00, 0x00, 0x00, 0x68, 0x65, 0x69, 0x63]);
    expect(await sniffHeicOrHeifContent(new File([bytes], "photo.bin"))).toBe(false);
  });
});

describe("prepareNativeHeicFile fallbacks", () => {
  it("returns null canvas path then uses heic2any when sniff succeeds", async () => {
    const originalImage = globalThis.Image;
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onerror?.();
      }
    }
    globalThis.Image = FailingImage as unknown as typeof Image;

    const bytes = new Uint8Array(16);
    bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const rawFile = new File([bytes], "photo.heic", { type: "image/heic" });

    const result = await prepareNativeHeicFile({
      rawFile,
      webPath: "capacitor://broken",
      thumbnailDataUrl: null,
      fileName: "photo.jpg",
    });

    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("photo.jpg");
    globalThis.Image = originalImage;
  });

  it("returns null when canvas context is unavailable", async () => {
    const originalImage = globalThis.Image;
    class LoadingImage {
      naturalWidth = 10;
      naturalHeight = 10;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    globalThis.Image = LoadingImage as unknown as typeof Image;
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    vi.spyOn(document, "createElement").mockReturnValue(canvas);

    await expect(
      prepareNativeHeicFile({
        rawFile: new File(["raw"], "photo.heic", { type: "image/heic" }),
        webPath: "capacitor://photo",
        thumbnailDataUrl: "data:image/jpeg;base64,eA==",
        fileName: "fallback.jpg",
      }),
    ).resolves.toMatchObject({ name: "fallback.jpg", type: "image/jpeg" });

    globalThis.Image = originalImage;
  });

  it("uses empty stem fallback when filename has no extension stem", async () => {
    const heic2any = await import("heic2any");
    vi.mocked(heic2any.default).mockResolvedValueOnce(
      new Blob(["jpeg"], { type: "image/jpeg" }),
    );
    const converted = await convertHeicChatImageToJpeg({
      name: ".heic",
      type: "image/heic",
      size: 1,
      lastModified: 1,
    } as File);
    expect(converted.name).toBe("image.jpg");
  });

  it("accepts heic2any array results", async () => {
    const heic2any = await import("heic2any");
    vi.mocked(heic2any.default).mockResolvedValueOnce([
      new Blob(["jpeg"], { type: "image/jpeg" }),
    ]);
    const converted = await convertHeicChatImageToJpeg({
      name: "shot.heic",
      type: "image/heic",
      size: 1,
      lastModified: 1,
    } as File);
    expect(converted.name).toBe("shot.jpg");
  });
});
