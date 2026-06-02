import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createBlobPreviewAttachment,
  prepareWebChatImageFile,
} from "../utils/chatImagePrepare";
import {
  isNativeCameraUserCancellation,
  isNativeChatImagePickerAvailable,
  pickChatImageFromNativeCamera,
  pickChatImagesFromNativeGallery,
  type ChatPickedImage,
} from "../utils/chatNativeImagePicker";
import {
  CHAT_MAX_IMAGES,
  normalizeChatImageFile,
  validateChatImageFile,
} from "../utils/chatImageValidation";

function nativePickErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "IMAGE_TOO_LARGE") {
    return "Cada imagem deve ter no máximo 5 MB.";
  }
  return "Não foi possível adicionar a imagem. Tente novamente.";
}

function revokeAttachmentPreview(item: ChatPickedImage): void {
  if (item.revokePreviewOnCleanup && item.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export function useChatComposerAttachments() {
  const [pendingAttachments, setPendingAttachments] = useState<ChatPickedImage[]>([]);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const pendingCountRef = useRef(0);
  const attachmentsRef = useRef(pendingAttachments);

  useEffect(() => {
    pendingCountRef.current = pendingAttachments.length;
    attachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach(revokeAttachmentPreview);
    },
    [],
  );

  const previewUrls = useMemo(
    () => pendingAttachments.map((item) => item.previewUrl),
    [pendingAttachments],
  );

  const pendingImages = useMemo(
    () => pendingAttachments.map((item) => item.file),
    [pendingAttachments],
  );

  const appendPickedImages = useCallback((incoming: ChatPickedImage[]) => {
    if (incoming.length === 0) return;

    setPendingAttachments((current) => {
      const next = [...current];
      for (const item of incoming) {
        if (next.length >= CHAT_MAX_IMAGES) {
          revokeAttachmentPreview(item);
          toast.error(`Você pode anexar no máximo ${CHAT_MAX_IMAGES} imagens.`);
          break;
        }
        next.push(item);
      }
      return next;
    });
  }, []);

  const acceptWebFiles = useCallback(
    async (incoming: File[]) => {
      setIsPreparingImages(true);

      try {
        const accepted: ChatPickedImage[] = [];

        for (const file of incoming) {
          const validationError = validateChatImageFile(file);
          if (validationError) {
            toast.error(validationError);
            continue;
          }

          try {
            const prepared = await prepareWebChatImageFile(file);
            const sizeError = validateChatImageFile(prepared);
            if (sizeError) {
              toast.error(sizeError);
              continue;
            }
            accepted.push(createBlobPreviewAttachment(prepared));
          } catch {
            toast.error(`Não foi possível preparar "${file.name}". Tente outra imagem.`);
          }
        }

        appendPickedImages(accepted);
      } finally {
        setIsPreparingImages(false);
      }
    },
    [appendPickedImages],
  );

  const acceptNativePicks = useCallback(
    async (incoming: ChatPickedImage[]) => {
      setIsPreparingImages(true);

      try {
        const accepted: ChatPickedImage[] = [];

        for (const item of incoming) {
          const validationError = validateChatImageFile(item.file);
          if (validationError) {
            revokeAttachmentPreview(item);
            toast.error(validationError);
            continue;
          }
          accepted.push(item);
        }

        appendPickedImages(accepted);
      } finally {
        setIsPreparingImages(false);
      }
    },
    [appendPickedImages],
  );

  const onSelectImages = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const incoming = Array.from(fileList).map(normalizeChatImageFile);
      await acceptWebFiles(incoming);
    },
    [acceptWebFiles],
  );

  const pickFromNativeCamera = useCallback(async () => {
    const remainingSlots = CHAT_MAX_IMAGES - pendingCountRef.current;
    if (remainingSlots <= 0) {
      toast.error(`Você pode anexar no máximo ${CHAT_MAX_IMAGES} imagens.`);
      return;
    }

    try {
      const picks = await pickChatImageFromNativeCamera();
      await acceptNativePicks(picks);
    } catch (error) {
      if (isNativeCameraUserCancellation(error)) return;
      toast.error(nativePickErrorMessage(error));
    }
  }, [acceptNativePicks]);

  const pickFromNativeGallery = useCallback(async () => {
    const remainingSlots = CHAT_MAX_IMAGES - pendingCountRef.current;
    if (remainingSlots <= 0) {
      toast.error(`Você pode anexar no máximo ${CHAT_MAX_IMAGES} imagens.`);
      return;
    }

    try {
      const picks = await pickChatImagesFromNativeGallery(remainingSlots);
      if (picks.length === 0) {
        toast.error("Não foi possível preparar as imagens selecionadas.");
        return;
      }
      await acceptNativePicks(picks);
    } catch (error) {
      if (isNativeCameraUserCancellation(error)) return;
      toast.error(nativePickErrorMessage(error));
    }
  }, [acceptNativePicks]);

  const removeImage = useCallback((index: number) => {
    setPendingAttachments((current) => {
      const removed = current[index];
      if (removed) revokeAttachmentPreview(removed);
      return current.filter((_, i) => i !== index);
    });
  }, []);

  const clearImages = useCallback(() => {
    setPendingAttachments((current) => {
      current.forEach(revokeAttachmentPreview);
      return [];
    });
  }, []);

  const hasImages = pendingAttachments.length > 0;

  const imageCountLabel = useMemo(
    () => `${pendingAttachments.length}/${CHAT_MAX_IMAGES}`,
    [pendingAttachments.length],
  );

  return {
    pendingImages,
    previewUrls,
    isPreparingImages,
    isNativePickerAvailable: isNativeChatImagePickerAvailable(),
    onSelectImages,
    pickFromNativeCamera,
    pickFromNativeGallery,
    removeImage,
    clearImages,
    hasImages,
    imageCountLabel,
    maxImages: CHAT_MAX_IMAGES,
  };
}

export type UseChatComposerAttachmentsReturn = ReturnType<typeof useChatComposerAttachments>;
