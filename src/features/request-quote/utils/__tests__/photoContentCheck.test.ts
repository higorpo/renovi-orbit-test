import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkPhotosContent } from "../photoContentCheck";

vi.mock("nsfwjs", () => ({
  load: vi.fn(),
}));

import * as nsfwjs from "nsfwjs";

const NSFW_THRESHOLD = 0.45;
const ERROR_MESSAGE =
  "Conteúdo da imagem não permitido. Envie apenas fotos do local ou do serviço.";
const VERIFICATION_FAILED =
  "Não foi possível verificar as imagens. Tente outra foto ou tente novamente.";

describe("photoContentCheck", () => {
  let mockClassify: ReturnType<typeof vi.fn>;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let originalImage: typeof globalThis.Image;

  beforeEach(() => {
    mockClassify = vi.fn();
    vi.mocked(nsfwjs.load).mockResolvedValue({ classify: mockClassify } as never);

    // Stub Image so loadImage() resolves in node/jsdom (no real image loading)
    originalImage = globalThis.Image;
    (globalThis as unknown as { Image: unknown }).Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      _src = "";
      set src(url: string) {
        this._src = url;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    };

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    (globalThis as unknown as { Image: unknown }).Image = originalImage;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.clearAllMocks();
  });

  function makeFile(name: string): File {
    return new File(["fake image bytes"], name, { type: "image/jpeg" });
  }

  describe("checkPhotosContent", () => {
    it("returns allowed true when files array is empty", async () => {
      const result = await checkPhotosContent([]);
      expect(result).toEqual({ allowed: true });
      expect(nsfwjs.load).not.toHaveBeenCalled();
    });

    it("returns allowed false when nsfwjs.load fails (fail closed)", async () => {
      vi.mocked(nsfwjs.load).mockRejectedValue(new Error("model load failed"));
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: false, error: VERIFICATION_FAILED });
    });

    it("returns allowed true when all predictions are below threshold", async () => {
      mockClassify.mockResolvedValue([
        { className: "Porn", probability: 0.1 },
        { className: "Hentai", probability: 0.1 },
        { className: "Sexy", probability: 0.2 },
      ]);
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: true });
      expect(nsfwjs.load).toHaveBeenCalledWith("MobileNetV2");
    });

    it("returns allowed false with error when Porn exceeds threshold", async () => {
      mockClassify.mockResolvedValue([
        { className: "Porn", probability: NSFW_THRESHOLD },
        { className: "Hentai", probability: 0 },
        { className: "Sexy", probability: 0 },
      ]);
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: false, error: ERROR_MESSAGE });
    });

    it("returns allowed false when Hentai exceeds threshold", async () => {
      mockClassify.mockResolvedValue([
        { className: "Porn", probability: 0 },
        { className: "Hentai", probability: 0.5 },
        { className: "Sexy", probability: 0 },
      ]);
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: false, error: ERROR_MESSAGE });
    });

    it("returns allowed false when Sexy exceeds threshold", async () => {
      mockClassify.mockResolvedValue([
        { className: "Porn", probability: 0 },
        { className: "Hentai", probability: 0 },
        { className: "Sexy", probability: 0.5 },
      ]);
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: false, error: ERROR_MESSAGE });
    });

    it("uses 0 when prediction class is missing", async () => {
      mockClassify.mockResolvedValue([]);
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: true });
    });

    it("stops at first disallowed image when multiple files", async () => {
      mockClassify
        .mockResolvedValueOnce([
          { className: "Porn", probability: 0 },
          { className: "Hentai", probability: 0 },
          { className: "Sexy", probability: 0 },
        ])
        .mockResolvedValueOnce([
          { className: "Porn", probability: 0.9 },
          { className: "Hentai", probability: 0 },
          { className: "Sexy", probability: 0 },
        ]);
      const result = await checkPhotosContent([
        makeFile("ok.jpg"),
        makeFile("bad.jpg"),
      ]);
      expect(result).toEqual({ allowed: false, error: ERROR_MESSAGE });
      expect(mockClassify).toHaveBeenCalledTimes(2);
    });

    it("returns allowed true when all multiple files are below threshold", async () => {
      mockClassify.mockResolvedValue([
        { className: "Porn", probability: 0 },
        { className: "Hentai", probability: 0 },
        { className: "Sexy", probability: 0.1 },
      ]);
      const result = await checkPhotosContent([
        makeFile("a.jpg"),
        makeFile("b.jpg"),
      ]);
      expect(result).toEqual({ allowed: true });
      expect(mockClassify).toHaveBeenCalledTimes(2);
    });

    it("returns allowed false when model.classify throws (fail closed)", async () => {
      mockClassify.mockRejectedValue(new Error("classify failed"));
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: false, error: VERIFICATION_FAILED });
    });

    it("returns allowed false when image onerror fires (loadImage fails)", async () => {
      (globalThis as unknown as { Image: unknown }).Image = class BadImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onerror?.());
        }
        get src() {
          return "";
        }
      };
      mockClassify.mockResolvedValue([]);
      const result = await checkPhotosContent([makeFile("broken.jpg")]);
      expect(result).toEqual({ allowed: false, error: VERIFICATION_FAILED });
    });

    it("logs non-Error when nsfwjs.load rejects with string", async () => {
      vi.mocked(nsfwjs.load).mockRejectedValue("string failure");
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: false, error: VERIFICATION_FAILED });
    });

    it("logs non-Error when classify throws non-Error", async () => {
      mockClassify.mockRejectedValue("boom");
      const result = await checkPhotosContent([makeFile("a.jpg")]);
      expect(result).toEqual({ allowed: false, error: VERIFICATION_FAILED });
    });
  });
});
