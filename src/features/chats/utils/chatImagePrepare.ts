import {
  normalizeChatImageFile,
  resolveChatImageMimeType,
  type ChatAllowedImageType,
} from "./chatImageValidation";

const HEIC_MIMES = new Set<ChatAllowedImageType>(["image/heic", "image/heif"]);

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);

function bytesMatch(buf: Uint8Array, offset: number, bytes: number[]): boolean {
  if (offset + bytes.length > buf.length) return false;
  return bytes.every((value, index) => buf[offset + index] === value);
}

function readBrand(buf: Uint8Array, offset: number): string {
  return String.fromCharCode(buf[offset]!, buf[offset + 1]!, buf[offset + 2]!, buf[offset + 3]!);
}

/** Detects HEIC/HEIF from file header (ISO-BMFF `ftyp`), regardless of declared MIME. */
export async function sniffHeicOrHeifContent(file: File): Promise<boolean> {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (buf.length < 12) return false;
  if (!bytesMatch(buf, 4, [0x66, 0x74, 0x79, 0x70])) return false;
  return HEIC_BRANDS.has(readBrand(buf, 8));
}

export function isHeicOrHeifChatImage(file: File): boolean {
  const mime = resolveChatImageMimeType(file);
  return mime !== null && HEIC_MIMES.has(mime);
}

export async function needsHeicConversion(file: File): Promise<boolean> {
  if (isHeicOrHeifChatImage(file)) return true;
  return sniffHeicOrHeifContent(file);
}

export function verifyImageLoads(file: File, timeoutMs = 4_000): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(result);
    };

    const timer = globalThis.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

export function verifyImageUrlLoads(url: string, timeoutMs = 4_000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      resolve(result);
    };

    const timer = globalThis.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

export async function convertHeicChatImageToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0]! : converted;
  const stem = file.name.replace(/\.(heic|heif|jpg|jpeg|png|webp)$/i, "") || "image";
  return new File([blob], `${stem}.jpg`, {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

async function convertImageUrlToJpegFile(url: string, fileName: string): Promise<File | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;

    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      resolve(file);
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        finish(null);
        return;
      }
      context.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            finish(null);
            return;
          }
          finish(
            new File([blob], fileName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            }),
          );
        },
        "image/jpeg",
        0.92,
      );
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
}

/** Web-only: convert HEIC/HEIF (or mislabeled HEIC) to a browser-displayable file. */
export async function prepareWebChatImageFile(file: File): Promise<File> {
  const normalized = normalizeChatImageFile(file);

  if (await needsHeicConversion(normalized)) {
    return convertHeicChatImageToJpeg(normalized);
  }

  return normalized;
}

/** Attempts native-friendly conversion; prefers thumbnail JPEG, avoids heic2any on native. */
export async function prepareNativeHeicFile(params: {
  rawFile: File;
  webPath: string;
  thumbnailDataUrl: string | null;
  fileName: string;
}): Promise<File> {
  if (params.webPath) {
    const canvasFile = await convertImageUrlToJpegFile(params.webPath, params.fileName);
    if (canvasFile) return canvasFile;
  }

  if (params.thumbnailDataUrl) {
    return fileFromDataUrl(params.thumbnailDataUrl, params.fileName);
  }

  if (await sniffHeicOrHeifContent(params.rawFile)) {
    try {
      return await convertHeicChatImageToJpeg(params.rawFile);
    } catch {
      // fall through
    }
  }

  throw new Error("NATIVE_HEIC_PREPARE_FAILED");
}

export function fileFromDataUrl(dataUrl: string, fileName: string): File {
  const [header, base64 = ""] = dataUrl.split(",");
  const mime = header?.match(/data:(.*?);/i)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], fileName, { type: mime, lastModified: Date.now() });
}

export async function prepareChatImageFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map(prepareWebChatImageFile));
}

/** @deprecated Use prepareWebChatImageFile on web. */
export async function prepareChatImageFile(file: File): Promise<File> {
  return prepareWebChatImageFile(file);
}

/** @deprecated Use prepareWebChatImageFile on web. */
export async function ensureChatImageDisplayable(file: File): Promise<File> {
  return prepareWebChatImageFile(file);
}

export function createBlobPreviewAttachment(file: File): {
  file: File;
  previewUrl: string;
  revokePreviewOnCleanup: boolean;
} {
  return {
    file,
    previewUrl: URL.createObjectURL(file),
    revokePreviewOnCleanup: true,
  };
}
