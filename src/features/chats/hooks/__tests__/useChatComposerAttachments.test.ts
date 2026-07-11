// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatComposerAttachments } from "../useChatComposerAttachments";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  prepareWebChatImageFile: vi.fn(async (file: File) => file),
  createBlobPreviewAttachment: vi.fn((file: File) => ({
    file,
    previewUrl: `blob:${file.name}`,
    revokePreviewOnCleanup: true,
  })),
  isNativeCameraUserCancellation: vi.fn(() => false),
  pickChatImageFromNativeCamera: vi.fn(),
  pickChatImagesFromNativeGallery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("../../utils/chatImagePrepare", () => ({
  prepareWebChatImageFile: mocks.prepareWebChatImageFile,
  createBlobPreviewAttachment: mocks.createBlobPreviewAttachment,
}));

vi.mock("../../utils/chatNativeImagePicker", () => ({
  isNativeChatImagePickerAvailable: () => true,
  isNativeCameraUserCancellation: mocks.isNativeCameraUserCancellation,
  pickChatImageFromNativeCamera: mocks.pickChatImageFromNativeCamera,
  pickChatImagesFromNativeGallery: mocks.pickChatImagesFromNativeGallery,
}));

describe("useChatComposerAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prepareWebChatImageFile.mockImplementation(async (file: File) => file);
    mocks.isNativeCameraUserCancellation.mockReturnValue(false);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

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
    expect(result.current.previewUrls[0]).toBe("blob:photo.jpg");
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
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a.jpg");
  });

  it("ignores empty selections and rejects invalid web files", async () => {
    const { result } = renderHook(() => useChatComposerAttachments());
    await act(async () => {
      await result.current.onSelectImages(null);
      await result.current.onSelectImages({
        0: new File(["x"], "notes.txt", { type: "text/plain" }),
        length: 1,
        item: () => null,
        [Symbol.iterator]: function* () {
          yield this[0];
        },
      } as FileList);
    });

    expect(result.current.pendingImages).toHaveLength(0);
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it("reports preparation failures and restores the loading state", async () => {
    mocks.prepareWebChatImageFile.mockRejectedValueOnce(new Error("conversion failed"));
    const { result } = renderHook(() => useChatComposerAttachments());
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

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

    expect(result.current.isPreparingImages).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Não foi possível preparar "photo.jpg". Tente outra imagem.',
    );
  });

  it("accepts native camera picks and revokes previews on clear", async () => {
    const pickedFile = new File(["x"], "camera.jpg", { type: "image/jpeg" });
    mocks.pickChatImageFromNativeCamera.mockResolvedValue([
      { file: pickedFile, previewUrl: "blob:camera", revokePreviewOnCleanup: true },
    ]);
    const { result } = renderHook(() => useChatComposerAttachments());

    await act(async () => {
      await result.current.pickFromNativeCamera();
    });
    expect(result.current.hasImages).toBe(true);
    expect(result.current.imageCountLabel).toBe("1/5");
    expect(result.current.isNativePickerAvailable).toBe(true);

    act(() => result.current.clearImages());
    expect(result.current.pendingImages).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:camera");
  });

  it("handles empty gallery picks and native picker errors", async () => {
    mocks.pickChatImagesFromNativeGallery.mockResolvedValueOnce([]);
    mocks.pickChatImageFromNativeCamera.mockRejectedValueOnce(new Error("IMAGE_TOO_LARGE"));
    const { result } = renderHook(() => useChatComposerAttachments());

    await act(async () => {
      await result.current.pickFromNativeGallery();
      await result.current.pickFromNativeCamera();
    });

    expect(mocks.pickChatImagesFromNativeGallery).toHaveBeenCalledWith(5);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Não foi possível preparar as imagens selecionadas.",
    );
    expect(mocks.toastError).toHaveBeenCalledWith("Cada imagem deve ter no máximo 5 MB.");
  });

  it("silently ignores native picker cancellation", async () => {
    mocks.pickChatImageFromNativeCamera.mockRejectedValueOnce(new Error("cancelled"));
    mocks.isNativeCameraUserCancellation.mockReturnValueOnce(true);
    const { result } = renderHook(() => useChatComposerAttachments());

    await act(async () => {
      await result.current.pickFromNativeCamera();
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("caps attachments and revokes excess and unmounted previews", async () => {
    const picks = Array.from({ length: 6 }, (_, index) => ({
      file: new File(["x"], `${index}.jpg`, { type: "image/jpeg" }),
      previewUrl: `blob:${index}`,
      revokePreviewOnCleanup: true,
    }));
    mocks.pickChatImagesFromNativeGallery.mockResolvedValue(picks);
    const { result, unmount } = renderHook(() => useChatComposerAttachments());

    await act(async () => {
      await result.current.pickFromNativeGallery();
    });

    expect(result.current.pendingImages).toHaveLength(5);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:5");
    expect(mocks.toastError).toHaveBeenCalledWith("Você pode anexar no máximo 5 imagens.");

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:0");
  });

  it("blocks native picks when the attachment limit is already reached", async () => {
    const picks = Array.from({ length: 5 }, (_, index) => ({
      file: new File(["x"], `${index}.jpg`, { type: "image/jpeg" }),
      previewUrl: `blob:${index}`,
      revokePreviewOnCleanup: true,
    }));
    mocks.pickChatImagesFromNativeGallery.mockResolvedValue(picks);
    const { result } = renderHook(() => useChatComposerAttachments());

    await act(async () => {
      await result.current.pickFromNativeGallery();
    });
    mocks.toastError.mockClear();

    await act(async () => {
      await result.current.pickFromNativeCamera();
      await result.current.pickFromNativeGallery();
    });

    expect(mocks.pickChatImageFromNativeCamera).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledWith("Você pode anexar no máximo 5 imagens.");
  });

  it("silently ignores gallery cancellation and maps generic native errors", async () => {
    mocks.pickChatImagesFromNativeGallery
      .mockRejectedValueOnce(new Error("cancelled"))
      .mockRejectedValueOnce(new Error("permission denied"));
    mocks.isNativeCameraUserCancellation.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const { result } = renderHook(() => useChatComposerAttachments());

    await act(async () => {
      await result.current.pickFromNativeGallery();
    });
    expect(mocks.toastError).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.pickFromNativeGallery();
    });
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Não foi possível adicionar a imagem. Tente novamente.",
    );
  });

  it("rejects native picks that fail validation and skips revoke for non-blob previews", async () => {
    const invalid = new File(["x"], "notes.txt", { type: "text/plain" });
    mocks.pickChatImageFromNativeCamera.mockResolvedValue([
      {
        file: invalid,
        previewUrl: "capacitor://localhost/notes.txt",
        revokePreviewOnCleanup: true,
      },
    ]);
    const { result } = renderHook(() => useChatComposerAttachments());

    await act(async () => {
      await result.current.pickFromNativeCamera();
    });

    expect(result.current.pendingImages).toHaveLength(0);
    expect(mocks.toastError).toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("capacitor://localhost/notes.txt");
  });

  it("rejects prepared web files that become invalid after conversion", async () => {
    mocks.prepareWebChatImageFile.mockResolvedValueOnce(
      new File([new Uint8Array(6 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" }),
    );
    const { result } = renderHook(() => useChatComposerAttachments());
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });

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

    expect(result.current.pendingImages).toHaveLength(0);
    expect(mocks.toastError).toHaveBeenCalledWith("Cada imagem deve ter no máximo 5 MB.");
  });
});
