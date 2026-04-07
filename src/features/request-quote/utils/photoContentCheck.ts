import { logger } from "@/lib/logger";

export type PhotoContentCheckResult =
  | { allowed: true }
  | { allowed: false; error: string };

/** Reject if Porn or Hentai probability exceeds this (0–1). */
const NSFW_THRESHOLD = 0.45;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Check photos for NSFW content. Uses nsfwjs in the browser; no server call.
 * If the model cannot load or an image cannot be verified, upload is blocked (fail closed).
 *
 * nsfwjs and TensorFlow are loaded only on demand (dynamic import) so the main bundle stays smaller.
 * We use MobileNetV2 only (smallest bundled model in nsfwjs).
 */
export async function checkPhotosContent(files: File[]): Promise<PhotoContentCheckResult> {
  if (files.length === 0) return { allowed: true };

  const errorContent = "Conteúdo da imagem não permitido. Envie apenas fotos do local ou do serviço.";
  const verificationFailed =
    "Não foi possível verificar as imagens. Tente outra foto ou tente novamente.";

  const { load } = await import("nsfwjs");

  let model: Awaited<ReturnType<typeof load>>;
  try {
    model = await load("MobileNetV2");
  } catch (e) {
    logger.warn("photo_content_check_model_load_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { allowed: false, error: verificationFailed };
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    let img: HTMLImageElement;
    try {
      img = await loadImage(file);
    } catch (e) {
      logger.warn("photo_content_check_image_load_failed", {
        fileName: file.name,
        error: e instanceof Error ? e.message : String(e),
      });
      return { allowed: false, error: verificationFailed };
    }

    try {
      const predictions = await model.classify(img);
      const porn = predictions.find((p) => p.className === "Porn")?.probability ?? 0;
      const hentai = predictions.find((p) => p.className === "Hentai")?.probability ?? 0;
      const sexy = predictions.find((p) => p.className === "Sexy")?.probability ?? 0;
      if (porn >= NSFW_THRESHOLD || hentai >= NSFW_THRESHOLD || sexy >= NSFW_THRESHOLD) {
        return { allowed: false, error: errorContent };
      }
    } catch (e) {
      logger.warn("photo_content_check_classify_failed", {
        fileName: file.name,
        error: e instanceof Error ? e.message : String(e),
      });
      return { allowed: false, error: verificationFailed };
    }
  }

  return { allowed: true };
}
