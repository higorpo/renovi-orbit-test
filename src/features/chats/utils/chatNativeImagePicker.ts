import {
  Camera,
  CameraErrorCode,
  MediaType,
  type MediaResult,
} from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { logger } from "@/lib/logger";
import {
  createBlobPreviewAttachment,
  fileFromDataUrl,
  isHeicOrHeifChatImage,
  needsHeicConversion,
  prepareNativeHeicFile,
} from "./chatImagePrepare";
import { CHAT_MAX_IMAGE_BYTES } from "./chatImageValidation";

const NATIVE_CAMERA_QUALITY = 90;

export interface ChatPickedImage {
  file: File;
  previewUrl: string;
  revokePreviewOnCleanup: boolean;
}

function mimeFromNativeFormat(format?: string): { mime: string; ext: string } {
  const normalized = format?.toLowerCase();
  if (normalized === "png") {
    return { mime: "image/png", ext: "png" };
  }
  if (normalized === "webp") {
    return { mime: "image/webp", ext: "webp" };
  }
  if (normalized === "heic") {
    return { mime: "image/heic", ext: "heic" };
  }
  if (normalized === "heif") {
    return { mime: "image/heif", ext: "heif" };
  }
  if (normalized === "jpeg" || normalized === "jpg") {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  return { mime: "image/jpeg", ext: "jpg" };
}

function mediaResultThumbnailDataUrl(result: MediaResult): string | null {
  if (!result.thumbnail) return null;
  return `data:image/jpeg;base64,${result.thumbnail}`;
}

function isHeicMediaResult(result: MediaResult, rawFile: File): boolean {
  const format = result.metadata?.format?.toLowerCase();
  if (format === "heic" || format === "heif") return true;
  return isHeicOrHeifChatImage(rawFile);
}

async function fetchNativeMediaBlob(result: MediaResult): Promise<Blob> {
  const candidates = [
    result.webPath,
    result.uri ? Capacitor.convertFileSrc(result.uri) : undefined,
  ].filter((value): value is string => Boolean(value));

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.blob();
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error("FETCH_FAILED");
}

function resolveNativePreviewUrl(result: MediaResult): string | null {
  return mediaResultThumbnailDataUrl(result) ?? result.webPath ?? null;
}

export function isNativeChatImagePickerAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export function isNativeCameraUserCancellation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return (
    code === CameraErrorCode.TakePhotoCancelled ||
    code === CameraErrorCode.ChooseMediaCancelled ||
    code === CameraErrorCode.EditPhotoCancelled
  );
}

async function mediaResultToPickedImage(
  result: MediaResult,
  index: number,
): Promise<ChatPickedImage | null> {
  if (result.type !== MediaType.Photo) {
    return null;
  }

  const previewUrl = resolveNativePreviewUrl(result);
  if (!previewUrl && !result.webPath && !result.uri) {
    return null;
  }

  if (typeof result.metadata?.size === "number" && result.metadata.size > CHAT_MAX_IMAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const blob = await fetchNativeMediaBlob(result);
  if (blob.size > CHAT_MAX_IMAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const { mime, ext } = mimeFromNativeFormat(result.metadata?.format ?? blob.type);
  const timestamp = Date.now();
  const fileName = `photo-${timestamp}-${index}.${ext}`;
  const rawFile = new File([blob], fileName, {
    type: blob.type || mime,
    lastModified: timestamp,
  });
  const thumbnailDataUrl = mediaResultThumbnailDataUrl(result);
  const displayPreviewUrl = previewUrl ?? result.webPath ?? thumbnailDataUrl;

  const heicByMetadata = isHeicMediaResult(result, rawFile);
  const heicByContent = heicByMetadata || (await needsHeicConversion(rawFile));

  if (heicByContent) {
    const converted = await prepareNativeHeicFile({
      rawFile,
      webPath: result.webPath ?? previewUrl ?? "",
      thumbnailDataUrl,
      fileName: fileName.replace(/\.(heic|heif)$/i, ".jpg"),
    });

    if (converted.size > CHAT_MAX_IMAGE_BYTES) {
      throw new Error("IMAGE_TOO_LARGE");
    }

    if (displayPreviewUrl) {
      return {
        file: converted,
        previewUrl: displayPreviewUrl,
        revokePreviewOnCleanup: false,
      };
    }

    return createBlobPreviewAttachment(converted);
  }

  if (displayPreviewUrl) {
    return {
      file: rawFile,
      previewUrl: displayPreviewUrl,
      revokePreviewOnCleanup: false,
    };
  }

  return createBlobPreviewAttachment(rawFile);
}

async function mediaResultsToPickedImages(results: MediaResult[]): Promise<ChatPickedImage[]> {
  const picked: ChatPickedImage[] = [];

  for (let index = 0; index < results.length; index++) {
    try {
      const item = await mediaResultToPickedImage(results[index]!, index);
      if (item) picked.push(item);
    } catch (error) {
      logger.warn("chat_native_gallery_item_failed", {
        index,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return picked;
}

export async function pickChatImageFromNativeCamera(): Promise<ChatPickedImage[]> {
  const result = await Camera.takePhoto({
    quality: NATIVE_CAMERA_QUALITY,
    includeMetadata: true,
  });
  const picked = await mediaResultToPickedImage(result, 0);
  return picked ? [picked] : [];
}

export async function pickChatImagesFromNativeGallery(limit: number): Promise<ChatPickedImage[]> {
  if (limit <= 0) return [];

  // includeMetadata:false avoids Android BitmapFactory HEIC decode failures that abort the whole batch.
  const { results } = await Camera.chooseFromGallery({
    allowMultipleSelection: limit > 1,
    limit,
    quality: NATIVE_CAMERA_QUALITY,
    includeMetadata: false,
  });

  return mediaResultsToPickedImages(results);
}

/** Builds a JPEG upload file from a native thumbnail when full-res conversion is unavailable. */
export function chatPickedImageFromThumbnailDataUrl(
  dataUrl: string,
  index: number,
): ChatPickedImage {
  const file = fileFromDataUrl(dataUrl, `photo-${Date.now()}-${index}.jpg`);
  return {
    file,
    previewUrl: dataUrl,
    revokePreviewOnCleanup: false,
  };
}
