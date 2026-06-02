// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChatComposerAttachments } from "../useChatComposerAttachments";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("../../utils/chatImagePrepare", () => ({
  prepareWebChatImageFile: vi.fn(async (file: File) => file),
  createBlobPreviewAttachment: vi.fn((file: File) => ({
    file,
    previewUrl: "blob:preview",
    revokePreviewOnCleanup: true,
  })),
}));

vi.mock("../../utils/chatNativeImagePicker", () => ({
  isNativeChatImagePickerAvailable: () => false,
  isNativeCameraUserCancellation: () => false,
  pickChatImageFromNativeCamera: vi.fn(),
  pickChatImagesFromNativeGallery: vi.fn(),
}));

describe("useChatComposerAttachments", () => {
  it("adds selected images and exposes preview URLs", async () => {
    const { result } = renderHook(() => useChatComposerAttachments());

    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    const list = {
      0: file,
      length: 1,
      item: (i: number) => (i === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as FileList;

    await act(async () => {
      await result.current.onSelectImages(list);
    });

    expect(result.current.pendingImages).toHaveLength(1);
    expect(result.current.previewUrls).toHaveLength(1);
    expect(result.current.previewUrls[0]).toBe("blob:preview");
  });

  it("removes image by index", async () => {
    const { result } = renderHook(() => useChatComposerAttachments());
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

    await act(async () => {
      await result.current.onSelectImages({
        0: file,
        length: 1,
        item: () => file,
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as FileList);
    });

    await act(async () => {
      result.current.removeImage(0);
    });

    expect(result.current.pendingImages).toHaveLength(0);
  });
});
