import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchClientReceivedBudgets,
  fetchClientBudgetQuestions,
  fetchClientBudgetDetail,
  respondClientBudgetQuestion,
  uploadQuestionResponseImages,
  getQuestionResponseImageUrl,
} from "../clientBudgets.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

// RPC mock — supabase is cast to RpcClient in the API
const rpcMock = vi.fn();
const { supabase } = await import("@/lib/supabase/client");
(supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc = rpcMock;

const authGetUserMock = vi.mocked(supabase.auth.getUser);
const storageFromMock = vi.mocked(supabase.storage.from);

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to build a valid paginated response
function paginatedResponse<T>(items: T[] = []) {
  return { items, total_count: items.length, page: 1, page_size: 10 };
}

describe("fetchClientReceivedBudgets", () => {
  it("returns paginated data on success", async () => {
    const payload = paginatedResponse([{ id: "budget-1" }]);
    rpcMock.mockResolvedValue({ data: payload, error: null });

    const result = await fetchClientReceivedBudgets({ page: 1, pageSize: 10, status: null, search: null });
    expect(result.data).toEqual(payload);
    expect(result.error).toBeNull();
  });

  it("returns error on RPC failure", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "RPC error" } });

    const result = await fetchClientReceivedBudgets({ page: 1, pageSize: 10, status: null, search: null });
    expect(result.data).toBeNull();
    expect(result.error).toBe("RPC error");
  });

  it("returns error when response is not paginated", async () => {
    rpcMock.mockResolvedValue({ data: { wrong: "shape" }, error: null });

    const result = await fetchClientReceivedBudgets({ page: 1, pageSize: 10, status: null, search: null });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Unexpected response from server");
  });
});

describe("fetchClientBudgetQuestions", () => {
  it("returns paginated data on success", async () => {
    const payload = paginatedResponse([{ id: "question-1" }]);
    rpcMock.mockResolvedValue({ data: payload, error: null });

    const result = await fetchClientBudgetQuestions({
      page: 1,
      pageSize: 10,
      questionStatus: null,
      search: null,
    });
    expect(result.data).toEqual(payload);
    expect(result.error).toBeNull();
  });

  it("returns error on failure", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Failed" } });

    const result = await fetchClientBudgetQuestions({
      page: 1,
      pageSize: 10,
      questionStatus: null,
      search: null,
    });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Failed");
  });

  it("returns error for invalid response shape", async () => {
    rpcMock.mockResolvedValue({ data: "string-response", error: null });

    const result = await fetchClientBudgetQuestions({
      page: 1,
      pageSize: 10,
      questionStatus: null,
      search: null,
    });
    expect(result.error).toBe("Unexpected response from server");
  });
});

describe("fetchClientBudgetDetail", () => {
  it("returns detail data on success", async () => {
    const detail = { id: "req-1", services: [] };
    rpcMock.mockResolvedValue({ data: detail, error: null });

    const result = await fetchClientBudgetDetail("req-1");
    expect(result.data).toEqual(detail);
    expect(result.error).toBeNull();
  });

  it("returns error on RPC failure", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const result = await fetchClientBudgetDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Not found");
  });

  it("returns error when response is null or not an object", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await fetchClientBudgetDetail("req-1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Unexpected response from server");
  });
});

describe("respondClientBudgetQuestion", () => {
  it("returns data on success", async () => {
    rpcMock.mockResolvedValue({ data: { success: true }, error: null });

    const result = await respondClientBudgetQuestion({
      questionId: "q-1",
      response: "My answer",
      imagePaths: [],
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ success: true });
  });

  it("returns error on RPC failure", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Cannot respond" } });

    const result = await respondClientBudgetQuestion({
      questionId: "q-1",
      response: "My answer",
      imagePaths: [],
    });
    expect(result.error).toBe("Cannot respond");
  });
});

describe("uploadQuestionResponseImages", () => {
  it("returns empty paths for empty files array", async () => {
    const result = await uploadQuestionResponseImages({
      serviceRequestId: "sr-1",
      questionId: "q-1",
      files: [],
    });
    expect(result.paths).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("returns error when file count exceeds MAX_IMAGES (5)", async () => {
    const files = Array.from({ length: 6 }, (_, i) =>
      new File(["content"], `file${i}.jpg`, { type: "image/jpeg" })
    );

    const result = await uploadQuestionResponseImages({
      serviceRequestId: "sr-1",
      questionId: "q-1",
      files,
    });
    expect(result.error).toContain("5");
    expect(result.paths).toEqual([]);
  });

  it("returns error when user is not authenticated", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const files = [new File(["content"], "file.jpg", { type: "image/jpeg" })];
    const result = await uploadQuestionResponseImages({
      serviceRequestId: "sr-1",
      questionId: "q-1",
      files,
    });
    expect(result.error).toBe("Usuário não autenticado");
  });

  it("returns error for disallowed file type", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    const files = [new File(["content"], "file.pdf", { type: "application/pdf" })];
    const result = await uploadQuestionResponseImages({
      serviceRequestId: "sr-1",
      questionId: "q-1",
      files,
    });
    expect(result.error).toContain("Formato não permitido");
  });

  it("returns error when file exceeds 5MB", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    // Create a fake file with size > 5MB
    const bigContent = new Uint8Array(6 * 1024 * 1024);
    const files = [new File([bigContent], "big.jpg", { type: "image/jpeg" })];
    const result = await uploadQuestionResponseImages({
      serviceRequestId: "sr-1",
      questionId: "q-1",
      files,
    });
    expect(result.error).toContain("5 MB");
  });

  it("uploads valid file and returns path on success", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    storageFromMock.mockReturnValue({ upload: uploadMock } as never);

    const files = [new File(["content"], "image.jpg", { type: "image/jpeg" })];
    const result = await uploadQuestionResponseImages({
      serviceRequestId: "sr-1",
      questionId: "q-1",
      files,
    });
    expect(result.error).toBeNull();
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toContain("user-1");
  });

  it("returns error when upload fails", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    const uploadMock = vi.fn().mockResolvedValue({ error: { message: "Upload failed" } });
    storageFromMock.mockReturnValue({ upload: uploadMock } as never);

    const files = [new File(["content"], "image.jpg", { type: "image/jpeg" })];
    const result = await uploadQuestionResponseImages({
      serviceRequestId: "sr-1",
      questionId: "q-1",
      files,
    });
    expect(result.error).toBe("Upload failed");
  });
});

describe("getQuestionResponseImageUrl", () => {
  it("returns empty string for empty path", async () => {
    const url = await getQuestionResponseImageUrl("");
    expect(url).toBe("");
  });

  it("returns path as-is for http URLs", async () => {
    const url = await getQuestionResponseImageUrl("https://example.com/image.jpg");
    expect(url).toBe("https://example.com/image.jpg");
  });

  it("returns signed URL for storage path", async () => {
    const createSignedUrlMock = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: "https://signed.url/image.jpg" }, error: null });
    storageFromMock.mockReturnValue({ createSignedUrl: createSignedUrlMock } as never);

    const url = await getQuestionResponseImageUrl("clients/user-1/image.jpg");
    expect(url).toBe("https://signed.url/image.jpg");
  });

  it("returns empty string when signed URL creation fails", async () => {
    const createSignedUrlMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Error" } });
    storageFromMock.mockReturnValue({ createSignedUrl: createSignedUrlMock } as never);

    const url = await getQuestionResponseImageUrl("clients/user-1/image.jpg");
    expect(url).toBe("");
  });
});
