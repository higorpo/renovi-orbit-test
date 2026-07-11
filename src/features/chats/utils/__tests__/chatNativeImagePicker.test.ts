// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@/lib/capacitor/__tests__/preferencesStorage.harness";
import {
  CameraErrorCode,
  MediaType,
  type MediaResult,
} from "@capacitor/camera";
import { CHAT_MAX_IMAGE_BYTES } from "../chatImageValidation";

const {
  takePhoto,
  chooseFromGallery,
  convertFileSrc,
  prepareNativeHeicFile,
  needsHeicConversion,
  isHeicOrHeifChatImage,
  createBlobPreviewAttachment,
  fileFromDataUrl,
  loggerWarn,
} = vi.hoisted(() => ({
  takePhoto: vi.fn(),
  chooseFromGallery: vi.fn(),
  convertFileSrc: vi.fn((uri: string) => `converted://${uri}`),
  prepareNativeHeicFile: vi.fn(),
  needsHeicConversion: vi.fn(async () => false),
  isHeicOrHeifChatImage: vi.fn(() => false),
  createBlobPreviewAttachment: vi.fn((file: File) => ({
    file,
    previewUrl: `blob:${file.name}`,
    revokePreviewOnCleanup: true,
  })),
  fileFromDataUrl: vi.fn(
    (dataUrl: string, fileName: string) =>
      new File(["thumb"], fileName, { type: "image/jpeg" }),
  ),
  loggerWarn: vi.fn(),
}));

vi.mock("@capacitor/camera", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/camera")>();
  return {
    ...actual,
    Camera: {
      takePhoto,
      chooseFromGallery,
    },
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    convertFileSrc,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: loggerWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../chatImagePrepare", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../chatImagePrepare")>();
  return {
    ...actual,
    prepareNativeHeicFile,
    needsHeicConversion,
    isHeicOrHeifChatImage,
    createBlobPreviewAttachment,
    fileFromDataUrl,
  };
});

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe("chatNativeImagePicker", () => {
  beforeEach(() => {
    takePhoto.mockReset();
    chooseFromGallery.mockReset();
    convertFileSrc.mockClear();
    prepareNativeHeicFile.mockReset();
    needsHeicConversion.mockReset();
    needsHeicConversion.mockResolvedValue(false);
    isHeicOrHeifChatImage.mockReset();
    isHeicOrHeifChatImage.mockReturnValue(false);
    createBlobPreviewAttachment.mockClear();
    fileFromDataUrl.mockClear();
    loggerWarn.mockClear();
    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob(["jpeg"], { type: "image/jpeg" }),
      })),
    );
  });

  it("returns true for native platform availability", async () => {
    const { isNativeChatImagePickerAvailable } = await import("../chatNativeImagePicker");
    expect(isNativeChatImagePickerAvailable()).toBe(true);
  });

  it("returns picked image with capacitor webPath preview for JPEG", async () => {
    const mediaResult: MediaResult = {
      type: MediaType.Photo,
      webPath: "capacitor://localhost/photo.jpg",
      saved: false,
      metadata: { format: "jpeg", size: 1200 },
    };
    takePhoto.mockResolvedValue(mediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    const picks = await pickChatImageFromNativeCamera();

    expect(picks).toHaveLength(1);
    expect(picks[0]?.previewUrl).toBe("capacitor://localhost/photo.jpg");
    expect(picks[0]?.revokePreviewOnCleanup).toBe(false);
    expect(picks[0]?.file.name).toMatch(/\.jpg$/);
  });

  it.each([
    ["png", "png"],
    ["webp", "webp"],
    ["heic", "heic"],
    ["heif", "heif"],
    ["jpg", "jpg"],
    ["unknown", "jpg"],
  ] as const)("maps native format %s to .%s extension", async (format, ext) => {
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/photo",
      saved: false,
      metadata: { format, size: 100 },
    } satisfies MediaResult);

    if (format === "heic" || format === "heif") {
      isHeicOrHeifChatImage.mockReturnValue(true);
      prepareNativeHeicFile.mockResolvedValue(
        new File(["jpg"], `converted.jpg`, { type: "image/jpeg" }),
      );
    }

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    const picks = await pickChatImageFromNativeCamera();

    if (format === "heic" || format === "heif") {
      expect(prepareNativeHeicFile).toHaveBeenCalled();
      expect(picks[0]?.file.name).toBe("converted.jpg");
    } else {
      expect(picks[0]?.file.name).toMatch(new RegExp(`\\.${ext}$`));
    }
  });

  it("maps gallery results to files respecting limit", async () => {
    const results: MediaResult[] = [
      {
        type: MediaType.Photo,
        webPath: "capacitor://localhost/a.jpg",
        saved: false,
        metadata: { format: "jpg", size: 900 },
      },
      {
        type: MediaType.Video,
        webPath: "capacitor://localhost/a.mp4",
        saved: false,
        metadata: { format: "mp4", size: 900 },
      },
    ];
    chooseFromGallery.mockResolvedValue({ results });

    const { pickChatImagesFromNativeGallery } = await import("../chatNativeImagePicker");
    const picks = await pickChatImagesFromNativeGallery(2);

    expect(chooseFromGallery).toHaveBeenCalledWith(
      expect.objectContaining({
        allowMultipleSelection: true,
        limit: 2,
        includeMetadata: false,
      }),
    );
    expect(picks).toHaveLength(1);
  });

  it("returns empty gallery picks when limit is zero", async () => {
    const { pickChatImagesFromNativeGallery } = await import("../chatNativeImagePicker");
    await expect(pickChatImagesFromNativeGallery(0)).resolves.toEqual([]);
    expect(chooseFromGallery).not.toHaveBeenCalled();
  });

  it("detects user cancellation error codes", async () => {
    const { isNativeCameraUserCancellation } = await import("../chatNativeImagePicker");

    expect(
      isNativeCameraUserCancellation({ code: CameraErrorCode.TakePhotoCancelled }),
    ).toBe(true);
    expect(
      isNativeCameraUserCancellation({ code: CameraErrorCode.ChooseMediaCancelled }),
    ).toBe(true);
    expect(
      isNativeCameraUserCancellation({ code: CameraErrorCode.EditPhotoCancelled }),
    ).toBe(true);
    expect(isNativeCameraUserCancellation({ code: "OTHER" })).toBe(false);
    expect(isNativeCameraUserCancellation(null)).toBe(false);
  });

  it("rejects oversized metadata before fetching the blob", async () => {
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/big.jpg",
      saved: false,
      metadata: { format: "jpeg", size: CHAT_MAX_IMAGE_BYTES + 1 },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    await expect(pickChatImageFromNativeCamera()).rejects.toThrow("IMAGE_TOO_LARGE");
  });

  it("rejects oversized blobs after fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([new Uint8Array(CHAT_MAX_IMAGE_BYTES + 1)], { type: "image/jpeg" }),
      })),
    );
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/big.jpg",
      saved: false,
      metadata: { format: "jpeg", size: 100 },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    await expect(pickChatImageFromNativeCamera()).rejects.toThrow("IMAGE_TOO_LARGE");
  });

  it("falls back to uri convertFileSrc when webPath fetch fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, blob: async () => new Blob([]) })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["jpeg"], { type: "image/jpeg" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/broken.jpg",
      uri: "file:///photo.jpg",
      saved: false,
      metadata: { format: "jpeg", size: 100 },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    const picks = await pickChatImageFromNativeCamera();

    expect(convertFileSrc).toHaveBeenCalledWith("file:///photo.jpg");
    expect(picks).toHaveLength(1);
  });

  it("returns empty when camera result has no usable paths", async () => {
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      saved: false,
      metadata: { format: "jpeg", size: 100 },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    await expect(pickChatImageFromNativeCamera()).resolves.toEqual([]);
  });

  it("uses thumbnail preview and converts HEIC via prepareNativeHeicFile", async () => {
    isHeicOrHeifChatImage.mockReturnValue(true);
    prepareNativeHeicFile.mockResolvedValue(
      new File(["jpg"], "photo-heic.jpg", { type: "image/jpeg" }),
    );
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/photo.heic",
      thumbnail: "thumb-bytes",
      saved: false,
      metadata: { format: "heic", size: 200 },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    const picks = await pickChatImageFromNativeCamera();

    expect(prepareNativeHeicFile).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailDataUrl: "data:image/jpeg;base64,thumb-bytes",
        fileName: expect.stringMatching(/\.jpg$/),
      }),
    );
    expect(picks[0]?.previewUrl).toBe("data:image/jpeg;base64,thumb-bytes");
    expect(picks[0]?.revokePreviewOnCleanup).toBe(false);
  });

  it("creates blob preview when HEIC conversion has no display preview", async () => {
    isHeicOrHeifChatImage.mockReturnValue(true);
    prepareNativeHeicFile.mockResolvedValue(
      new File(["jpg"], "converted.jpg", { type: "image/jpeg" }),
    );
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      uri: "file:///photo.heic",
      saved: false,
      metadata: { format: "heic", size: 200 },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    const picks = await pickChatImageFromNativeCamera();

    expect(createBlobPreviewAttachment).toHaveBeenCalled();
    expect(picks[0]?.previewUrl).toBe("blob:converted.jpg");
  });

  it("rejects HEIC conversion that exceeds size limit", async () => {
    isHeicOrHeifChatImage.mockReturnValue(true);
    prepareNativeHeicFile.mockResolvedValue(
      new File([new Uint8Array(CHAT_MAX_IMAGE_BYTES + 1)], "converted.jpg", {
        type: "image/jpeg",
      }),
    );
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/photo.heic",
      saved: false,
      metadata: { format: "heic", size: 200 },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    await expect(pickChatImageFromNativeCamera()).rejects.toThrow("IMAGE_TOO_LARGE");
  });

  it("creates blob preview when JPEG has no display preview url", async () => {
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      uri: "file:///photo.jpg",
      saved: false,
      metadata: { format: "jpeg", size: 100 },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    const picks = await pickChatImageFromNativeCamera();

    expect(createBlobPreviewAttachment).toHaveBeenCalled();
    expect(picks[0]?.revokePreviewOnCleanup).toBe(true);
  });

  it("skips failed gallery items and continues with the rest", async () => {
    chooseFromGallery.mockResolvedValue({
      results: [
        {
          type: MediaType.Photo,
          webPath: "capacitor://localhost/big.jpg",
          saved: false,
          metadata: { format: "jpeg", size: CHAT_MAX_IMAGE_BYTES + 1 },
        },
        {
          type: MediaType.Photo,
          webPath: "capacitor://localhost/ok.jpg",
          saved: false,
          metadata: { format: "jpeg", size: 100 },
        },
      ] satisfies MediaResult[],
    });

    const { pickChatImagesFromNativeGallery } = await import("../chatNativeImagePicker");
    const picks = await pickChatImagesFromNativeGallery(2);

    expect(picks).toHaveLength(1);
    expect(loggerWarn).toHaveBeenCalledWith(
      "chat_native_gallery_item_failed",
      expect.objectContaining({ index: 0, error: "IMAGE_TOO_LARGE" }),
    );
  });

  it("builds a picked image from a thumbnail data url", async () => {
    const { chatPickedImageFromThumbnailDataUrl } = await import("../chatNativeImagePicker");
    const picked = chatPickedImageFromThumbnailDataUrl("data:image/jpeg;base64,abc", 3);

    expect(fileFromDataUrl).toHaveBeenCalledWith(
      "data:image/jpeg;base64,abc",
      expect.stringMatching(/^photo-\d+-3\.jpg$/),
    );
    expect(picked.previewUrl).toBe("data:image/jpeg;base64,abc");
    expect(picked.revokePreviewOnCleanup).toBe(false);
  });

  it("returns no camera pick for a non-photo media result", async () => {
    takePhoto.mockResolvedValue({
      type: MediaType.Video,
      webPath: "capacitor://localhost/video.mp4",
      saved: false,
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    await expect(pickChatImageFromNativeCamera()).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a single-select gallery and recovers when the first fetch throws", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("web path unavailable"))
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["jpeg"], { type: "image/jpeg" }),
      } as Response);
    chooseFromGallery.mockResolvedValue({
      results: [
        {
          type: MediaType.Photo,
          webPath: "capacitor://localhost/photo.jpg",
          uri: "file:///photo.jpg",
          saved: false,
          metadata: { format: "jpeg" },
        },
      ] satisfies MediaResult[],
    });

    const { pickChatImagesFromNativeGallery } = await import("../chatNativeImagePicker");
    await expect(pickChatImagesFromNativeGallery(1)).resolves.toHaveLength(1);
    expect(chooseFromGallery).toHaveBeenCalledWith(
      expect.objectContaining({ allowMultipleSelection: false }),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws FETCH_FAILED when every native media URL fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/broken.jpg",
      uri: "file:///broken.jpg",
      saved: false,
      metadata: { format: "jpeg" },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    await expect(pickChatImageFromNativeCamera()).rejects.toThrow("FETCH_FAILED");
  });

  it("converts HEIC detected from content when metadata reports JPEG", async () => {
    needsHeicConversion.mockResolvedValueOnce(true);
    prepareNativeHeicFile.mockResolvedValue(
      new File(["jpeg"], "converted-from-content.jpg", { type: "image/jpeg" }),
    );
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/mislabeled.jpg",
      saved: false,
      metadata: { format: "jpeg" },
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    const picks = await pickChatImageFromNativeCamera();

    expect(needsHeicConversion).toHaveBeenCalled();
    expect(prepareNativeHeicFile).toHaveBeenCalled();
    expect(picks[0]?.file.name).toBe("converted-from-content.jpg");
  });

  it("falls back to JPEG mime and extension when native format is absent", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["jpeg"]),
    } as Response);
    takePhoto.mockResolvedValue({
      type: MediaType.Photo,
      webPath: "capacitor://localhost/photo",
      saved: false,
    } satisfies MediaResult);

    const { pickChatImageFromNativeCamera } = await import("../chatNativeImagePicker");
    const picks = await pickChatImageFromNativeCamera();

    expect(picks[0]?.file.type).toBe("image/jpeg");
    expect(picks[0]?.file.name).toMatch(/\.jpg$/);
  });

  it("logs non-Error gallery conversion failures and keeps processing", async () => {
    needsHeicConversion
      .mockRejectedValueOnce("content-check-failed")
      .mockResolvedValueOnce(false);
    chooseFromGallery.mockResolvedValue({
      results: [
        {
          type: MediaType.Photo,
          webPath: "capacitor://localhost/a.jpg",
          saved: false,
          metadata: { format: "jpeg" },
        },
        {
          type: MediaType.Photo,
          webPath: "capacitor://localhost/b.jpg",
          saved: false,
          metadata: { format: "jpeg" },
        },
      ] satisfies MediaResult[],
    });

    const { pickChatImagesFromNativeGallery } = await import("../chatNativeImagePicker");
    await expect(pickChatImagesFromNativeGallery(2)).resolves.toHaveLength(1);
    expect(loggerWarn).toHaveBeenCalledWith(
      "chat_native_gallery_item_failed",
      expect.objectContaining({ index: 0, error: "content-check-failed" }),
    );
  });
});
