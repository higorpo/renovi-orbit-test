// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@/lib/capacitor/__tests__/preferencesStorage.harness";
import {
  CameraErrorCode,
  MediaType,
  type MediaResult,
} from "@capacitor/camera";

const { takePhoto, chooseFromGallery } = vi.hoisted(() => ({
  takePhoto: vi.fn(),
  chooseFromGallery: vi.fn(),
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
  },
}));

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

  it("detects user cancellation error codes", async () => {
    const { isNativeCameraUserCancellation } = await import("../chatNativeImagePicker");

    expect(
      isNativeCameraUserCancellation({ code: CameraErrorCode.TakePhotoCancelled }),
    ).toBe(true);
    expect(
      isNativeCameraUserCancellation({ code: CameraErrorCode.ChooseMediaCancelled }),
    ).toBe(true);
    expect(isNativeCameraUserCancellation({ code: "OTHER" })).toBe(false);
  });
});
