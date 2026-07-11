// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY } from "../../constants/queryKeys";
import { useServiceRequestBudgetProposalDialogs } from "../useServiceRequestBudgetProposalDialogs";

const useProposalDetailMock = vi.fn();

vi.mock("../useProposalDetail", () => ({
  useProposalDetail: (params: unknown) => useProposalDetailMock(params),
}));

function createWrapper() {
  const queryClient = new QueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  return {
    invalidateQueries,
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useProposalDetailMock.mockReturnValue({ data: undefined });
});

describe("useServiceRequestBudgetProposalDialogs", () => {
  it.each([
    ["accept", "acceptOpen", "acceptProposalId"],
    ["reject", "rejectOpen", "rejectProposalId"],
    ["request_revision", "revisionOpen", "revisionProposalId"],
  ] as const)("opens the %s dialog for the selected proposal", (action, openKey, idKey) => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useServiceRequestBudgetProposalDialogs("request-1"),
      { wrapper },
    );

    act(() => result.current.handleProposalAction(action, "proposal-1"));

    expect(result.current[openKey]).toBe(true);
    expect(result.current[idKey]).toBe("proposal-1");
  });

  it("loads detail only while accept and revision dialogs are open", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useServiceRequestBudgetProposalDialogs("request-1"),
      { wrapper },
    );

    expect(useProposalDetailMock).toHaveBeenCalledWith({
      proposalId: null,
      enabled: false,
      audience: "client",
    });

    act(() => result.current.handleProposalAction("accept", "proposal-1"));

    expect(useProposalDetailMock).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      enabled: true,
      audience: "client",
    });
  });

  it("moves from accept to date-unavailable revision with derived notes", () => {
    useProposalDetailMock.mockImplementation(
      ({ proposalId }: { proposalId: string | null }) => ({
        data: proposalId
          ? {
              proposal_suggested_slots: [
                { start_date: "2099-03-10", end_date: null, shift: "morning" },
              ],
            }
          : undefined,
      }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useServiceRequestBudgetProposalDialogs("request-1"),
      { wrapper },
    );

    act(() => result.current.handleProposalAction("accept", "proposal-1"));
    act(() => result.current.handleAcceptRequestRevision());

    expect(result.current.acceptOpen).toBe(false);
    expect(result.current.acceptProposalId).toBeNull();
    expect(result.current.revisionOpen).toBe(true);
    expect(result.current.revisionProposalId).toBe("proposal-1");
    expect(result.current.revisionInitialValues).toMatchObject({
      revisionReason: "DATE_NOT_AVAILABLE",
      revisionNotes: expect.stringContaining("Nenhuma das datas sugeridas"),
    });
  });

  it("clears dialog state and invalidates comparison when closed", () => {
    const { wrapper, invalidateQueries } = createWrapper();
    const { result } = renderHook(
      () => useServiceRequestBudgetProposalDialogs("request-1"),
      { wrapper },
    );

    act(() => result.current.handleProposalAction("reject", "proposal-1"));
    act(() => result.current.handleRejectDialogOpenChange(false));

    expect(result.current.rejectOpen).toBe(false);
    expect(result.current.rejectProposalId).toBeNull();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, "request-1"],
      refetchType: "active",
    });
  });

  it("does not invalidate comparison without a service request", () => {
    const { wrapper, invalidateQueries } = createWrapper();
    const { result } = renderHook(
      () => useServiceRequestBudgetProposalDialogs(null),
      { wrapper },
    );

    act(() => result.current.handleAcceptDialogOpenChange(false));

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("closes accept and revision dialogs and clears revision seed values", () => {
    useProposalDetailMock.mockReturnValue({ data: undefined });
    const { wrapper, invalidateQueries } = createWrapper();
    const { result } = renderHook(
      () => useServiceRequestBudgetProposalDialogs("request-1"),
      { wrapper },
    );

    act(() => result.current.handleProposalAction("accept", "proposal-1"));
    act(() => result.current.handleAcceptDialogOpenChange(false));
    expect(result.current.acceptOpen).toBe(false);
    expect(result.current.acceptProposalId).toBeNull();

    act(() => result.current.handleProposalAction("request_revision", "proposal-2"));
    act(() => result.current.handleRevisionDialogOpenChange(false));
    expect(result.current.revisionOpen).toBe(false);
    expect(result.current.revisionProposalId).toBeNull();
    expect(result.current.revisionInitialValues).toBeNull();
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it("ignores accept-to-revision when accept proposal id is missing", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useServiceRequestBudgetProposalDialogs("request-1"),
      { wrapper },
    );

    act(() => result.current.handleAcceptRequestRevision());
    expect(result.current.revisionOpen).toBe(false);
  });
});
