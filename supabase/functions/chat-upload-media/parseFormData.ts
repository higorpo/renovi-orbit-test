import type { ParseFormDataResult } from "./types.ts";

const FILE_FIELD_NAMES = new Set(["file", "file[]", "files"]);

function isFileField(key: string): boolean {
  return FILE_FIELD_NAMES.has(key) || key.startsWith("file[");
}

function extractFiles(formData: FormData): File[] {
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (isFileField(key) && value instanceof File && value.size > 0) {
      files.push(value);
    }
  }
  return files;
}

export function parseFormData(formData: FormData): ParseFormDataResult {
  const chatId = formData.get("chat_id")?.toString().trim() ?? "";
  const uploadSessionId = formData.get("upload_session_id")?.toString().trim() ?? "";
  const idempotencyKey = formData.get("idempotency_key")?.toString().trim() ?? "";

  if (!chatId) {
    return { ok: false, error: "chat_id is required.", status: 400 };
  }
  if (!uploadSessionId) {
    return { ok: false, error: "upload_session_id is required.", status: 400 };
  }

  const files = extractFiles(formData);
  if (files.length === 0) {
    return { ok: false, error: "At least one image file is required.", status: 400 };
  }

  return { ok: true, chatId, uploadSessionId, idempotencyKey: idempotencyKey || undefined, files };
}
