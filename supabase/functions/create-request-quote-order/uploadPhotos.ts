import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SERVICE_REQUESTS_BUCKET,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_TYPES,
} from "./constants.ts";
import { validateMagicBytes } from "./fileSignatures.ts";

export type UploadPhotosResult =
  | { ok: true; paths: string[] }
  | { ok: false; error: string };

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  photoBlobs: Blob[]
): Promise<UploadPhotosResult> {
  if (photoBlobs.length === 0) return { ok: true, paths: [] };
  if (photoBlobs.length > MAX_PHOTOS) {
    return { ok: false, error: `Máximo de ${MAX_PHOTOS} fotos permitido.` };
  }
  const paths: string[] = [];
  const ts = Date.now();

  for (let i = 0; i < photoBlobs.length; i++) {
    const blob = photoBlobs[i];
    if (blob.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: `Foto ${i + 1} excede o tamanho máximo permitido.` };
    }
    const type = blob.type?.toLowerCase() || "";
    if (!ALLOWED_PHOTO_TYPES.includes(type)) {
      return {
        ok: false,
        error: `Foto ${i + 1}: tipo não permitido. Use JPEG, PNG, WebP, HEIC ou HEIF.`,
      };
    }
    const contentMatches = await validateMagicBytes(blob, type);
    if (!contentMatches) {
      return { ok: false, error: `Foto ${i + 1}: tipo de arquivo não corresponde ao conteúdo.` };
    }
    const ext = EXT_BY_TYPE[type] || "jpg";
    const path = `${userId}/${ts}_${i}.${ext}`;

    const { error } = await supabase.storage
      .from(SERVICE_REQUESTS_BUCKET)
      .upload(path, blob, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error("[uploadPhotos]", path, error.message);
      return { ok: false, error: "Falha ao enviar fotos. Tente novamente." };
    }

    paths.push(path);
  }

  return { ok: true, paths };
}
