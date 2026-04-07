import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServiceRequest, uploadPhotosForRequest } from "../serviceRequests.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const fromMock = vi.mocked(supabase.from);
const storageFromMock = vi.mocked(supabase.storage.from);

let terminalResult: { data: unknown; error: { message: string } | null } | null = null;

function makeChain() {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(terminalResult).then(onFulfilled);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  terminalResult = null;
  fromMock.mockReturnValue(makeChain() as never);
});

describe("createServiceRequest", () => {
  const params = {
    client_id: "client-1",
    service_id: "svc-1",
    title: "Fix my lights",
    description: "Lights are flickering",
  };

  it("returns service request on success", async () => {
    const request = { id: "req-1", ...params };
    terminalResult = { data: request, error: null };

    const result = await createServiceRequest(params);
    expect(result.request).toEqual(request);
    expect(result.error).toBeNull();
  });

  it("returns error on DB failure", async () => {
    terminalResult = { data: null, error: { message: "Insert failed" } };

    const result = await createServiceRequest(params);
    expect(result.request).toBeNull();
    expect(result.error).toBe("Insert failed");
  });

  it("uses open as default status", async () => {
    const request = { id: "req-1", status: "open" };
    terminalResult = { data: request, error: null };

    await createServiceRequest(params);
    const chainCall = fromMock.mock.results[0]?.value;
    expect(chainCall.insert.mock.calls[0][0].status).toBe("open");
  });

  it("includes optional fields when provided", async () => {
    const request = { id: "req-1" };
    terminalResult = { data: request, error: null };

    await createServiceRequest({
      ...params,
      address_id: "addr-1",
      photos: ["photo-1.jpg"],
      form_data: { key: "value" },
    });
    const chainCall = fromMock.mock.results[0]?.value;
    const insertArg = chainCall.insert.mock.calls[0][0];
    expect(insertArg.address_id).toBe("addr-1");
    expect(insertArg.photos).toEqual(["photo-1.jpg"]);
  });

  it("stores null description when omitted", async () => {
    terminalResult = { data: { id: "r1" }, error: null };
    await createServiceRequest({
      client_id: "c1",
      service_id: "s1",
      title: "T",
      description: null,
    });
    const chainCall = fromMock.mock.results[0]?.value;
    expect(chainCall.insert.mock.calls[0][0].description).toBeNull();
  });

  it("passes custom status to insert payload", async () => {
    const request = { id: "req-1", status: "draft" };
    terminalResult = { data: request, error: null };

    await createServiceRequest({
      ...params,
      status: "draft",
    });
    const chainCall = fromMock.mock.results[0]?.value;
    expect(chainCall.insert.mock.calls[0][0].status).toBe("draft");
  });
});

describe("uploadPhotosForRequest", () => {
  it("returns empty urls for empty files array", async () => {
    const result = await uploadPhotosForRequest("client-1", []);
    expect(result.urls).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("uploads file and returns public URL", async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl: "https://cdn.example.com/photo.jpg" } });
    storageFromMock.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    } as never);

    const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });
    const result = await uploadPhotosForRequest("client-1", [file]);

    expect(result.error).toBeNull();
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0]).toBe("https://cdn.example.com/photo.jpg");
  });

  it("returns error when upload fails", async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: { message: "Upload failed" } });
    storageFromMock.mockReturnValue({ upload: uploadMock } as never);

    const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });
    const result = await uploadPhotosForRequest("client-1", [file]);

    expect(result.error).toBe("Upload failed");
    expect(result.urls).toEqual([]);
  });

  it("uses jpg extension when file name has no dot segment", async () => {
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrlMock = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/x.jpg" },
    });
    storageFromMock.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    } as never);

    const file = new File(["c"], "", { type: "image/jpeg" });
    await uploadPhotosForRequest("client-1", [file]);

    expect(uploadMock.mock.calls[0][0]).toMatch(/\.jpg$/);
  });

  it("returns partial urls when second file upload fails", async () => {
    const uploadMock = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "Second failed" } });
    const getPublicUrlMock = vi.fn().mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/only.jpg" },
    });
    storageFromMock.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    } as never);

    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ];
    const result = await uploadPhotosForRequest("client-1", files);

    expect(result.error).toBe("Second failed");
    expect(result.urls).toEqual(["https://cdn.example.com/only.jpg"]);
  });
});
