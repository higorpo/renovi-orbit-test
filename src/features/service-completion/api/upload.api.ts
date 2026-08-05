/**
 * Completion evidence upload: create session → Storage.upload (RLS) → register.
 * KYC pattern — no Edge signed-URL helper.
 */

import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { extractRpcErrorCode } from "../utils/rpcErrors";
import {
  COMPLETION_EVIDENCE_BUCKET,
  completionEvidenceObjectPath,
} from "../utils/evidenceStoragePath";
import type {
  CreateUploadSessionInput,
  CreateUploadSessionResult,
  CreateUploadSessionSuccess,
  RegisterUploadObjectInput,
  RegisterUploadObjectResult,
  UploadEvidenceFileInput,
  UploadEvidenceFileResult,
} from "../types/completion.types";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

type RpcSession = {
  ok?: boolean;
  idempotent?: boolean;
  upload_session_id?: string;
  contracted_service_id?: string;
  criterion_block_id?: string;
  status?: string;
  storage_bucket?: string;
  storage_prefix?: string;
  max_files?: number;
  expires_at?: string;
};

type RpcRegister = {
  ok?: boolean;
  upload_object_id?: string;
  object_id?: string;
  upload_session_id?: string;
  storage_path?: string;
};

export function validateEvidenceImageFile(file: File): string | null {
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    return "Formato não permitido. Use JPEG, PNG, WebP, HEIC ou HEIF.";
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return `A imagem deve ter no máximo ${MAX_EVIDENCE_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

export async function createUploadSession(
  input: CreateUploadSessionInput,
): Promise<CreateUploadSessionResult> {
  const { data, error } = await supabase.rpc(
    "service_completion_create_upload_session" as never,
    {
      p_contracted_service_id: input.contractedServiceId,
      p_criterion_block_id: input.criterionBlockId,
      p_idempotency_key: input.idempotencyKey ?? null,
    } as never,
  );

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("service_completion_create_upload_session_failed", {
      contractedServiceId: input.contractedServiceId,
      criterionBlockId: input.criterionBlockId,
      errorCode,
      error: error.message,
    });
    return { data: null, error: error.message, errorCode };
  }

  const payload = (data ?? {}) as RpcSession;
  if (typeof payload.upload_session_id !== "string") {
    return {
      data: null,
      error: "Resposta inválida ao criar sessão de upload",
      errorCode: "INVALID_RESPONSE",
    };
  }

  const success: CreateUploadSessionSuccess = {
    uploadSessionId: payload.upload_session_id,
    contractedServiceId:
      payload.contracted_service_id ?? input.contractedServiceId,
    criterionBlockId: payload.criterion_block_id ?? input.criterionBlockId,
    status: payload.status ?? "open",
    storageBucket: payload.storage_bucket ?? COMPLETION_EVIDENCE_BUCKET,
    storagePrefix: payload.storage_prefix ?? "",
    maxFiles: typeof payload.max_files === "number" ? payload.max_files : 5,
    expiresAt: payload.expires_at ?? "",
    idempotent: Boolean(payload.idempotent),
  };

  return { data: success, error: null };
}

export async function registerUploadObject(
  input: RegisterUploadObjectInput,
): Promise<RegisterUploadObjectResult> {
  const { data, error } = await supabase.rpc(
    "service_completion_register_upload_object" as never,
    {
      p_upload_session_id: input.uploadSessionId,
      p_storage_path: input.storagePath,
      p_content_checksum: input.contentChecksum ?? null,
      p_byte_size: input.byteSize ?? null,
    } as never,
  );

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("service_completion_register_upload_object_failed", {
      uploadSessionId: input.uploadSessionId,
      errorCode,
      error: error.message,
    });
    return { data: null, error: error.message, errorCode };
  }

  const payload = (data ?? {}) as RpcRegister;
  if (typeof payload.storage_path !== "string") {
    return {
      data: null,
      error: "Resposta inválida ao registrar evidência",
      errorCode: "INVALID_RESPONSE",
    };
  }

  return {
    data: {
      objectId:
        typeof payload.upload_object_id === "string"
          ? payload.upload_object_id
          : typeof payload.object_id === "string"
            ? payload.object_id
            : "",
      uploadSessionId:
        typeof payload.upload_session_id === "string"
          ? payload.upload_session_id
          : input.uploadSessionId,
      storagePath: payload.storage_path,
    },
    error: null,
  };
}

/** Full path: create session → Storage.upload (RLS) → register object. */
export async function uploadEvidenceFile(
  input: UploadEvidenceFileInput,
): Promise<UploadEvidenceFileResult> {
  const validationError = validateEvidenceImageFile(input.file);
  if (validationError) {
    return { path: null, error: validationError, errorCode: "INVALID_FILE" };
  }

  const session = await createUploadSession({
    contractedServiceId: input.contractedServiceId,
    criterionBlockId: input.criterionBlockId,
    idempotencyKey: input.idempotencyKey ?? null,
  });
  if (session.error || !session.data) {
    return {
      path: null,
      error: session.error ?? "Falha ao criar sessão de upload",
      errorCode: session.errorCode,
    };
  }

  const storagePath = completionEvidenceObjectPath(
    session.data.storagePrefix,
    input.file.name || "evidence.jpg",
    input.file.type || undefined,
  );
  const bucket = session.data.storageBucket || COMPLETION_EVIDENCE_BUCKET;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: input.file.type || undefined,
    });

  if (uploadError) {
    logger.warn("completion_evidence_storage_upload_failed", {
      uploadSessionId: session.data.uploadSessionId,
      error: uploadError.message,
    });
    return {
      path: null,
      error: uploadError.message,
      errorCode: "STORAGE_UPLOAD_FAILED",
    };
  }

  const registered = await registerUploadObject({
    uploadSessionId: session.data.uploadSessionId,
    storagePath,
    byteSize: input.file.size,
  });
  if (registered.error || !registered.data) {
    return {
      path: null,
      error: registered.error ?? "Falha ao registrar evidência",
      errorCode: registered.errorCode,
    };
  }

  return { path: registered.data.storagePath, error: null };
}

export const uploadApi = {
  createUploadSession,
  registerUploadObject,
  uploadEvidenceFile,
  validateEvidenceImageFile,
};
