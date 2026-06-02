import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CHAT_MAX_IMAGES,
  normalizeChatImageFile,
  validateChatImageFile,
} from "../utils/chatImageValidation";

export function useChatComposerAttachments() {
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = pendingImages.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingImages]);

  const onSelectImages = useCallback((fileList: FileList | null) => {
    if (!fileList?.length) return;

    const incoming = Array.from(fileList).map(normalizeChatImageFile);
    setPendingImages((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (next.length >= CHAT_MAX_IMAGES) {
          toast.error(`Você pode anexar no máximo ${CHAT_MAX_IMAGES} imagens.`);
          break;
        }
        const validationError = validateChatImageFile(file);
        if (validationError) {
          toast.error(validationError);
          continue;
        }
        next.push(file);
      }
      return next;
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setPendingImages((current) => current.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setPendingImages([]);
  }, []);

  const hasImages = pendingImages.length > 0;

  const imageCountLabel = useMemo(
    () => `${pendingImages.length}/${CHAT_MAX_IMAGES}`,
    [pendingImages.length],
  );

  return {
    pendingImages,
    previewUrls,
    onSelectImages,
    removeImage,
    clearImages,
    hasImages,
    imageCountLabel,
    maxImages: CHAT_MAX_IMAGES,
  };
}

export type UseChatComposerAttachmentsReturn = ReturnType<typeof useChatComposerAttachments>;
