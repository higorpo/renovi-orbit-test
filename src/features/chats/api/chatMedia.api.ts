import { FunctionsHttpError } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import type { ChatsApiResult } from "../types/chats.types";
import { mapCnsRpcError } from "../utils/chatApiErrors";
import { CNS_CHAT_RPC } from "./chats.rpc";

export interface CreateMediaUploadSessionResult {
  upload_session_id: string;
  chat_id: string;
  expires_at: string;
}

interface UploadChatMediaResponse {
  paths?: string[];
  error?: string;
  message?: string;
}

interface RefreshMediaSignedUrlsResult {
  bucket: string;
  expires_in: number;
  paths: string[];
}

function isRefreshMediaSignedUrlsResult(value: unknown): value is RefreshMediaSignedUrlsResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.bucket === "string" &&
    typeof v.expires_in === "number" &&
    Array.isArray(v.paths) &&
    v.paths.every((path) => typeof path === "string")
  );
}

function isCreateMediaUploadSessionResult(value: unknown): value is CreateMediaUploadSessionResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.upload_session_id === "string" && typeof v.chat_id === "string";
}

async function readEdgeFunctionErrorMessage(error: FunctionsHttpError): Promise<string> {
  try {
    const context = error.context;
    if (context && typeof context.json === "function") {
      const body = (await context.json()) as UploadChatMediaResponse;
      if (typeof body.error === "string") return body.error;
      if (typeof body.message === "string") return body.message;
    }
  } catch {
    // fall through to generic message
  }
  return error.message;
}

export async function createMediaUploadSession(
  chatId: string,
): Promise<ChatsApiResult<CreateMediaUploadSessionResult>> {
  const { data, error } = await supabase.rpc(CNS_CHAT_RPC.createMediaUploadSession, {
    p_chat_id: chatId,
  });

  if (error) {
    const mapped = mapCnsRpcError(error);
    return { data: null, error: mapped };
  }

  if (!isCreateMediaUploadSessionResult(data)) {
    logger.error("chats_create_media_upload_session_invalid_response", { chatId, data });
    return {
      data: null,
      error: { code: "UNKNOWN", message: "Resposta inesperada do servidor." },
    };
  }

  return { data, error: null };
}

export async function uploadChatMedia(params: {
  chatId: string;
  uploadSessionId: string;
  files: File[];
  idempotencyKey?: string;
}): Promise<{ paths: string[]; error: string | null }> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    return { paths: [], error: sessionError?.message ?? "Usuário não autenticado" };
  }

  const formData = new FormData();
  formData.set("chat_id", params.chatId);
  formData.set("upload_session_id", params.uploadSessionId);
  if (params.idempotencyKey) {
    formData.set("idempotency_key", params.idempotencyKey);
  }
  params.files.forEach((file, index) => {
    formData.append("file", file, file.name || `image-${index}.jpg`);
  });

  try {
    const { data, error } = await supabase.functions.invoke("chat-upload-media", {
      body: formData,
    });

    if (error) {
      const message =
        error instanceof FunctionsHttpError
          ? await readEdgeFunctionErrorMessage(error)
          : error.message;

      const userMessage =
        message === "unauthorized"
          ? "Sessão expirada ou inválida. Faça login novamente e tente enviar a imagem."
          : message;

      logger.error("chats_upload_media_invoke_error", {
        chatId: params.chatId,
        error: message,
      });
      return { paths: [], error: userMessage };
    }

    const body = data as UploadChatMediaResponse | null;
    if (body?.error) {
      logger.error("chats_upload_media_error", {
        chatId: params.chatId,
        error: body.error,
      });
      return { paths: [], error: body.error };
    }

    const paths = body?.paths;
    if (!Array.isArray(paths) || paths.some((path) => typeof path !== "string")) {
      logger.error("chats_upload_media_invalid_response", { chatId: params.chatId, body });
      return { paths: [], error: "Resposta inválida do servidor." };
    }

    return { paths, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_error";
    logger.error("chats_upload_media_network_error", {
      chatId: params.chatId,
      error: message,
    });
    return { paths: [], error: "Não foi possível enviar as imagens. Verifique sua conexão." };
  }
}

export async function resolveChatImageDisplayUrls(params: {
  messageId?: string;
  paths?: string[];
}): Promise<{ urls: string[]; error: string | null }> {
  const messageIds =
    params.messageId && !params.messageId.startsWith("optimistic:")
      ? [params.messageId]
      : null;
  const storagePaths = params.paths?.length ? params.paths : null;

  if (!messageIds?.length && !storagePaths?.length) {
    return { urls: [], error: null };
  }

  const { data, error } = await supabase.rpc(CNS_CHAT_RPC.refreshMediaSignedUrls, {
    p_message_ids: messageIds ?? undefined,
    p_paths: storagePaths ?? undefined,
    p_expires_in: 3600,
  });

  if (error) {
    logger.error("chats_refresh_media_signed_urls_error", {
      messageId: params.messageId,
      error: error.message,
    });
    return { urls: [], error: error.message };
  }

  if (!isRefreshMediaSignedUrlsResult(data)) {
    logger.error("chats_refresh_media_signed_urls_invalid_response", { data });
    return { urls: [], error: "Resposta inesperada do servidor." };
  }

  const urls: string[] = [];
  for (const path of data.paths) {
    const { data: signed, error: signError } = await supabase.storage
      .from(data.bucket)
      .createSignedUrl(path, data.expires_in);

    if (signError || !signed?.signedUrl) {
      logger.warn("chats_create_signed_url_failed", {
        path,
        error: signError?.message,
      });
      continue;
    }
    urls.push(signed.signedUrl);
  }

  if (urls.length === 0) {
    return { urls: [], error: "Não foi possível carregar a imagem." };
  }

  return { urls, error: null };
}
