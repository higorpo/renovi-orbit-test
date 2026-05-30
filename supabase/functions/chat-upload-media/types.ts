export type ValidateUploadSessionResult = {
  upload_session_id: string;
  chat_id: string;
  uploader_id: string;
  status: string;
  expires_at: string;
  storage_path_prefix: string;
};

export type UploadChatMediaSuccess = {
  paths: string[];
};

export type ParseFormDataResult =
  | {
      ok: true;
      chatId: string;
      uploadSessionId: string;
      idempotencyKey?: string;
      files: File[];
    }
  | { ok: false; error: string; status: number };
