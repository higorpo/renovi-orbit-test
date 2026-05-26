// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useRequestQuoteServices } from "../useRequestQuoteServices";

vi.mock("../../api/services.api", () => ({
  listServicesForRequestQuote: vi.fn(),
}));

const listServicesForRequestQuote = await import("../../api/services.api").then(
  (m) => vi.mocked(m.listServicesForRequestQuote)
);

const mockServices = [
  {
    id: "s1",
    slug: "limpeza",
    title: "Limpeza",
    description: "",
    active: true,
    show_on_request_quote: true,
    parent_id: null,
    form_id: "f1",
    icon_key: "Wrench",
    color_key: "slate",
    image_url: null,
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ai_prompt_id: null,
  },
  {
    id: "s2",
    slug: "outro",
    title: "Outro",
    description: "",
    active: true,
    show_on_request_quote: true,
    parent_id: null,
    form_id: "f2",
    icon_key: "Wrench",
    color_key: "slate",
    image_url: null,
    sort_order: 1,
    created_at: "",
    updated_at: "",
    ai_prompt_id: null,
    children: [],
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useRequestQuoteServices", () => {
  const onServiceSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    listServicesForRequestQuote.mockResolvedValue({
      services: mockServices,
      error: null,
    });
  });

  it("returns services and isLoading from query", async () => {
    const { result } = renderHook(
      () =>
        useRequestQuoteServices({
          urlServiceSlug: null,
          loadingSession: false,
          onServiceSelect,
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.services).toEqual(mockServices);
    expect(result.current.error).toBeNull();
  });

  it("returns error when API returns error", async () => {
    listServicesForRequestQuote.mockResolvedValue({
      services: [],
      error: "Network error",
    });
    const { result } = renderHook(
      () =>
        useRequestQuoteServices({
          urlServiceSlug: null,
          loadingSession: false,
          onServiceSelect,
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe("Network error");
    expect(result.current.services).toEqual([]);
  });

  it("calls onServiceSelect when urlServiceSlug matches a service and not loadingSession", async () => {
    const servicesWithChild = [
      {
        ...mockServices[0],
        slug: "limpeza",
        children: [{ ...mockServices[1], slug: "limpeza-profunda", parent_id: "s1" }],
      },
    ];
    listServicesForRequestQuote.mockResolvedValue({
      services: servicesWithChild,
      error: null,
    });
    const { result } = renderHook(
      () =>
        useRequestQuoteServices({
          urlServiceSlug: "limpeza-profunda",
          loadingSession: false,
          onServiceSelect,
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    await waitFor(() => {
      expect(onServiceSelect).toHaveBeenCalled();
    });
    expect(onServiceSelect).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "limpeza-profunda" })
    );
  });

  it("does not call onServiceSelect when loadingSession is true", async () => {
    listServicesForRequestQuote.mockResolvedValue({
      services: mockServices,
      error: null,
    });
    const { result } = renderHook(
      () =>
        useRequestQuoteServices({
          urlServiceSlug: "limpeza",
          loadingSession: true,
          onServiceSelect,
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(onServiceSelect).not.toHaveBeenCalled();
  });

  it("does not call onServiceSelect when services length is 0", async () => {
    listServicesForRequestQuote.mockResolvedValue({
      services: [],
      error: null,
    });
    renderHook(
      () =>
        useRequestQuoteServices({
          urlServiceSlug: "limpeza",
          loadingSession: false,
          onServiceSelect,
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(true).toBe(true));
    expect(onServiceSelect).not.toHaveBeenCalled();
  });

  it("does not call onServiceSelect when urlServiceSlug does not match any service", async () => {
    listServicesForRequestQuote.mockResolvedValue({
      services: mockServices,
      error: null,
    });
    const { result } = renderHook(
      () =>
        useRequestQuoteServices({
          urlServiceSlug: "unknown-slug",
          loadingSession: false,
          onServiceSelect,
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(onServiceSelect).not.toHaveBeenCalled();
  });

  it("does not call onServiceSelect when urlServiceSlug is null", async () => {
    const { result } = renderHook(
      () =>
        useRequestQuoteServices({
          urlServiceSlug: null,
          loadingSession: false,
          onServiceSelect,
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(onServiceSelect).not.toHaveBeenCalled();
  });
});
