// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLatestProviderProposal } from "../useLatestProviderProposal";
import { useProposalDetail } from "../useProposalDetail";

const getProposalDetailMock = vi.fn();
const getLatestProviderProposalMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("../../api/proposals.api", () => ({
  getProposalDetail: (...args: unknown[]) => getProposalDetailMock(...args),
  getLatestProviderProposalForServiceRequest: (...args: unknown[]) =>
    getLatestProviderProposalMock(...args),
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => useAuthMock(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const proposal = {
  id: "proposal-1",
  service_request_id: "request-1",
  provider_id: "provider-1",
  status: "SUBMITTED",
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue({
    user: { id: "provider-1" },
    profile: { role: "provider" },
  });
});

describe("useProposalDetail", () => {
  it("loads detail for the requested audience", async () => {
    getProposalDetailMock.mockResolvedValue({ data: proposal, error: null });
    const { result } = renderHook(
      () => useProposalDetail({ proposalId: "proposal-1", audience: "client" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getProposalDetailMock).toHaveBeenCalledWith("proposal-1", "client");
    expect(result.current.data).toEqual(proposal);
  });

  it("does not fetch without an id or when disabled", () => {
    renderHook(() => useProposalDetail({ proposalId: null }), {
      wrapper: createWrapper(),
    });
    renderHook(
      () => useProposalDetail({ proposalId: "proposal-1", enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(getProposalDetailMock).not.toHaveBeenCalled();
  });

  it("surfaces API and empty-data failures", async () => {
    getProposalDetailMock.mockResolvedValue({
      data: null,
      error: { message: "Proposal unavailable" },
    });
    const { result } = renderHook(
      () => useProposalDetail({ proposalId: "proposal-1" }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("Proposal unavailable"));
  });
});

describe("useLatestProviderProposal", () => {
  it("trims the request id and loads the provider proposal", async () => {
    getLatestProviderProposalMock.mockResolvedValue({ data: proposal, error: null });
    const { result } = renderHook(
      () => useLatestProviderProposal("  request-1  "),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getLatestProviderProposalMock).toHaveBeenCalledWith({
      serviceRequestId: "request-1",
      providerId: "provider-1",
    });
    expect(result.current.data).toEqual(proposal);
  });

  it.each([
    ["empty request", " ", { user: { id: "provider-1" }, profile: { role: "provider" } }],
    ["anonymous user", "request-1", { user: null, profile: null }],
    ["client profile", "request-1", { user: { id: "client-1" }, profile: { role: "client" } }],
  ])("does not fetch for %s", (_case, requestId, auth) => {
    useAuthMock.mockReturnValue(auth);

    renderHook(() => useLatestProviderProposal(requestId), {
      wrapper: createWrapper(),
    });

    expect(getLatestProviderProposalMock).not.toHaveBeenCalled();
  });

  it("surfaces API errors", async () => {
    getLatestProviderProposalMock.mockResolvedValue({
      data: null,
      error: "Provider proposal unavailable",
    });
    const { result } = renderHook(
      () => useLatestProviderProposal("request-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("Provider proposal unavailable"));
  });
});
