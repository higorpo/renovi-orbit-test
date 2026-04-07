import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useServiceSchema } from "../useServiceSchema";
import type { FormRow } from "../../types/request-quote.types";
import type { Service } from "../../types/request-quote.types";
import type { SchemaValidationResult } from "@/features/dynamic-form";

vi.mock("../../api/services.api", () => ({
  getServiceBySlug: vi.fn(),
  getServiceById: vi.fn(),
}));

vi.mock("../../api/forms.api", () => ({
  getFormById: vi.fn(),
}));

vi.mock("@/features/dynamic-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/dynamic-form")>();
  return {
    ...actual,
    validateFormSchema: vi.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    } as SchemaValidationResult),
  };
});

const getServiceBySlug = await import("../../api/services.api").then(
  (m) => vi.mocked(m.getServiceBySlug)
);
const getServiceById = await import("../../api/services.api").then(
  (m) => vi.mocked(m.getServiceById)
);
const getFormById = await import("../../api/forms.api").then(
  (m) => vi.mocked(m.getFormById)
);
const validateFormSchema = await import("@/features/dynamic-form").then(
  (m) => vi.mocked(m.validateFormSchema)
);

const validFormSchema = {
  version: "2.0",
  id: "f1",
  title: "Form",
  metadata: {},
  config: {},
  steps: [],
};

const mockService: Service = {
  id: "s1",
  slug: "limpeza",
  form_id: "form-1",
  title: "Limpeza",
  description: "",
  active: true,
  show_on_request_quote: true,
  parent_id: null,
  icon_key: "Wrench",
  color_key: "slate",
  image_url: null,
  sort_order: 0,
  created_at: "",
  updated_at: "",
  ai_prompt_id: null,
};

function mockForm(overrides: Partial<FormRow> = {}): FormRow {
  return {
    id: "form-1",
    form_schema: validFormSchema,
    form_status: "active",
    ...overrides,
  } as FormRow;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useServiceSchema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServiceBySlug.mockResolvedValue({ service: null, error: null });
    getServiceById.mockResolvedValue({ service: null, error: null });
    getFormById.mockResolvedValue({ form: null, error: null });
    validateFormSchema.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    } as SchemaValidationResult);
  });

  it("returns no_service_slug_or_id when both serviceSlug and serviceId are null", async () => {
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: null, serviceId: null }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.schema).toBeNull();
    expect(result.current.fallbackReason).toBe("no_service_slug_or_id");
    expect(getServiceBySlug).not.toHaveBeenCalled();
    expect(getServiceById).not.toHaveBeenCalled();
  });

  it("returns no_service_slug_or_id when both are undefined", async () => {
    const { result } = renderHook(() => useServiceSchema({}), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.fallbackReason).toBe("no_service_slug_or_id");
  });

  it("fetches by slug when serviceSlug is provided", async () => {
    getServiceBySlug.mockResolvedValue({
      service: mockService,
      error: null,
    });
    getFormById.mockResolvedValue({
      form: mockForm(),
      error: null,
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza", serviceId: null }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.schema).not.toBeNull();
    });
    expect(getServiceBySlug).toHaveBeenCalledWith("limpeza");
    expect(getServiceById).not.toHaveBeenCalled();
    expect(result.current.fallbackReason).toBeNull();
    expect(result.current.schema).toMatchObject({
      version: "2.0",
      metadata: expect.objectContaining({
        categorySlug: "limpeza",
        categoryId: "s1",
      }),
    });
  });

  it("fetches by id when serviceId is provided and serviceSlug is null", async () => {
    getServiceById.mockResolvedValue({
      service: mockService,
      error: null,
    });
    getFormById.mockResolvedValue({
      form: mockForm(),
      error: null,
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: null, serviceId: "s1" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.schema).not.toBeNull();
    });
    expect(getServiceById).toHaveBeenCalledWith("s1");
    expect(getServiceBySlug).not.toHaveBeenCalled();
  });

  it("returns loading when service query is loading", async () => {
    getServiceBySlug.mockImplementation(
      () => new Promise(() => {})
    );
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    expect(result.current.fallbackReason).toBe("loading");
  });

  it("returns service_fetch_failed when getServiceBySlug throws", async () => {
    getServiceBySlug.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useServiceSchema({ serviceSlug: "limpeza" }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(result.current.fallbackReason).toBe("service_fetch_failed");
    });
  });

  it("returns service_fetch_failed when service API returns error", async () => {
    getServiceBySlug.mockResolvedValue({
      service: null,
      error: "Not found",
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.schema).toBeNull();
    expect(result.current.fallbackReason).toBe("service_fetch_failed");
  });

  it("returns service_not_found when service is null", async () => {
    getServiceBySlug.mockResolvedValue({ service: null, error: null });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "missing" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.fallbackReason).toBe("service_not_found");
  });

  it("returns no_form when service has no form_id or form fetch returns null", async () => {
    getServiceBySlug.mockResolvedValue({
      service: { ...mockService, form_id: null },
      error: null,
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.fallbackReason).toBe("no_form");
  });

  it("returns no_form when getFormById returns form null", async () => {
    getServiceBySlug.mockResolvedValue({ service: mockService, error: null });
    getFormById.mockResolvedValue({ form: null, error: null });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.fallbackReason).toBe("no_form");
  });

  it("returns form_inactive when form_status is not active", async () => {
    getServiceBySlug.mockResolvedValue({ service: mockService, error: null });
    getFormById.mockResolvedValue({
      form: mockForm({ form_status: "draft" }),
      error: null,
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.fallbackReason).toBe("form_inactive");
  });

  it("returns no_v2_schema when form_schema is invalid", async () => {
    getServiceBySlug.mockResolvedValue({ service: mockService, error: null });
    getFormById.mockResolvedValue({
      form: mockForm({ form_schema: { version: "1.0" } }),
      error: null,
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.fallbackReason).toBe("no_v2_schema");
  });

  it("returns schema_validation_failed when validateFormSchema fails", async () => {
    getServiceBySlug.mockResolvedValue({ service: mockService, error: null });
    getFormById.mockResolvedValue({
      form: mockForm(),
      error: null,
    });
    validateFormSchema.mockReturnValue({
      valid: false,
      errors: [
        { code: "INVALID_STEP", message: "Invalid step", severity: "error" },
      ],
      warnings: [],
    } as SchemaValidationResult);
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.fallbackReason).toBe("schema_validation_failed");
  });

  it("loads service by serviceId when slug is not provided", async () => {
    getServiceById.mockResolvedValue({ service: mockService, error: null });
    getFormById.mockResolvedValue({ form: mockForm(), error: null });
    const { result } = renderHook(() => useServiceSchema({ serviceId: "s1" }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(result.current.schema).not.toBeNull();
    });
    expect(getServiceById).toHaveBeenCalledWith("s1");
    expect(getServiceBySlug).not.toHaveBeenCalled();
  });

  it("returns no_v2_schema when form_schema is a JSON array", async () => {
    getServiceBySlug.mockResolvedValue({ service: mockService, error: null });
    getFormById.mockResolvedValue({
      form: mockForm({ form_schema: [] as unknown as FormRow["form_schema"] }),
      error: null,
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.fallbackReason).toBe("no_v2_schema");
    });
  });

  it("preserves categorySlug from schema metadata when set", async () => {
    const schemaWithMeta = {
      ...validFormSchema,
      metadata: { categorySlug: "custom-slug", categoryId: "keep-me" },
    };
    getServiceBySlug.mockResolvedValue({ service: mockService, error: null });
    getFormById.mockResolvedValue({
      form: mockForm({ form_schema: schemaWithMeta }),
      error: null,
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.schema).not.toBeNull();
    });
    expect(result.current.schema!.metadata.categorySlug).toBe("custom-slug");
    expect(result.current.schema!.metadata.categoryId).toBe("keep-me");
  });

  it("uses service.id for categoryId when slug is missing", async () => {
    const serviceNoSlug = { ...mockService, slug: null } as unknown as Service;
    getServiceBySlug.mockResolvedValue({
      service: serviceNoSlug,
      error: null,
    });
    getFormById.mockResolvedValue({
      form: mockForm(),
      error: null,
    });
    const { result } = renderHook(
      () => useServiceSchema({ serviceSlug: "limpeza" }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.schema).not.toBeNull();
    });
    expect(result.current.schema!.metadata.categorySlug).toBe("s1");
    expect(result.current.schema!.metadata.categoryId).toBe("s1");
  });
});
