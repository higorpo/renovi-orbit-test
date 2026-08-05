import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUploadSession,
  registerUploadObject,
  uploadEvidenceFile,
  validateEvidenceImageFile,
} from "../upload.api";

const mockRpc = vi.fn();
const mockUpload = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
      }),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("validateEvidenceImageFile", () => {
  it("rejects non-image types", () => {
    const file = new File(["x"], "a.pdf", { type: "application/pdf" });
    expect(validateEvidenceImageFile(file)).toMatch(/formato/i);
  });

  it("accepts jpeg", () => {
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    expect(validateEvidenceImageFile(file)).toBeNull();
  });
});

describe("createUploadSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps RPC success payload", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        upload_session_id: "sess-1",
        contracted_service_id: "cs-1",
        criterion_block_id: "crit_1",
        status: "open",
        storage_bucket: "completion-evidence",
        storage_prefix: "cs-1/crit_1/",
        max_files: 5,
        expires_at: "2026-08-04T20:00:00Z",
      },
      error: null,
    });

    const result = await createUploadSession({
      contractedServiceId: "cs-1",
      criterionBlockId: "crit_1",
    });

    expect(result.error).toBeNull();
    expect(result.data?.uploadSessionId).toBe("sess-1");
    expect(mockRpc).toHaveBeenCalledWith(
      "service_completion_create_upload_session",
      expect.objectContaining({
        p_contracted_service_id: "cs-1",
        p_criterion_block_id: "crit_1",
      }),
    );
  });
});

describe("registerUploadObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps upload_object_id", async () => {
    mockRpc.mockResolvedValue({
      data: {
        ok: true,
        upload_object_id: "obj-1",
        upload_session_id: "sess-1",
        storage_path: "prefix/obj.jpg",
      },
      error: null,
    });

    const result = await registerUploadObject({
      uploadSessionId: "sess-1",
      storagePath: "prefix/obj.jpg",
    });

    expect(result.data?.objectId).toBe("obj-1");
    expect(result.data?.storagePath).toBe("prefix/obj.jpg");
  });
});

describe("uploadEvidenceFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs create → storage.upload → register", async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: {
          upload_session_id: "sess-1",
          storage_bucket: "completion-evidence",
          storage_prefix: "cs-1/sess-1/",
          max_files: 5,
          status: "open",
          criterion_block_id: "crit_1",
          contracted_service_id: "cs-1",
          expires_at: "2026-08-04T20:00:00Z",
        },
        error: null,
      })
      .mockImplementationOnce((_name: string, args: { p_storage_path: string }) =>
        Promise.resolve({
          data: {
            upload_object_id: "obj-1",
            upload_session_id: "sess-1",
            storage_path: args.p_storage_path,
          },
          error: null,
        }),
      );

    mockUpload.mockResolvedValue({ data: { path: "ok" }, error: null });

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const result = await uploadEvidenceFile({
      contractedServiceId: "cs-1",
      criterionBlockId: "crit_1",
      file,
    });

    expect(result.error).toBeNull();
    expect(result.path).toMatch(/^cs-1\/sess-1\/.+\.jpg$/);
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^cs-1\/sess-1\/.+\.jpg$/),
      file,
      expect.objectContaining({ upsert: false, contentType: "image/jpeg" }),
    );
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      "service_completion_register_upload_object",
      expect.objectContaining({
        p_upload_session_id: "sess-1",
        p_storage_path: result.path,
      }),
    );
  });
});
