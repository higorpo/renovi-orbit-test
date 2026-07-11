// @vitest-environment happy-dom
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationDetailResponse } from "../../../types/chats.types";
import { ChatsConversationRoute } from "../ChatsConversationRoute";

const navigateMock = vi.fn();
const mutateCloseMock = vi.fn();
const openProposalComposerCreateMock = vi.fn();
const openProposalComposerEditMock = vi.fn();
const openProposalDetailsMock = vi.fn();
const openProposeDialogMock = vi.fn();
const handleProposalActionMock = vi.fn();
const handleRescheduleActionMock = vi.fn();
const invalidateChatProposalQueriesMock = vi.fn();
const invalidateChatRescheduleQueriesMock = vi.fn();

const routeState = vi.hoisted(() => ({
  chatId: "chat-1" as string | undefined,
  showDetailsColumn: false,
  profile: {
    id: "client-1",
    role: "client" as const,
    full_name: "Maria Cliente",
    profile_image_path: null,
  },
  detail: null as ConversationDetailResponse | null,
  acceptOpen: false,
  rejectOpen: false,
  revisionOpen: false,
  detailsDialogOpen: false,
  proposeOpen: false,
  acceptRescheduleOpen: false,
  adjustmentOpen: false,
  cancelOpen: false,
  closePending: false,
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ chatId: routeState.chatId }),
    useLocation: () => ({ search: "?from=list", pathname: `/chats/${routeState.chatId}` }),
  };
});

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ profile: routeState.profile }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => routeState.showDetailsColumn,
}));

vi.mock("../../../hooks/useConversationDetail", () => ({
  useConversationDetail: () => ({ detail: routeState.detail }),
}));

vi.mock("../../../hooks/useCloseConversationMutation", () => ({
  useCloseConversationMutation: () => ({
    mutate: mutateCloseMock,
    isPending: routeState.closePending,
  }),
}));

vi.mock("../../../hooks/useInvalidateChatProposalQueries", () => ({
  useInvalidateChatProposalQueries: () => invalidateChatProposalQueriesMock,
}));

vi.mock("../../../hooks/useInvalidateChatRescheduleQueries", () => ({
  useInvalidateChatRescheduleQueries: () => invalidateChatRescheduleQueriesMock,
}));

vi.mock("../../../hooks/useChatProposalDialogs", () => ({
  useChatProposalDialogs: () => ({
    acceptOpen: routeState.acceptOpen,
    acceptProposalId: "p-accept",
    acceptProposalDetailQuery: {
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    },
    handleAcceptDialogOpenChange: vi.fn(),
    handleAcceptRequestRevision: vi.fn(),
    rejectOpen: routeState.rejectOpen,
    rejectProposalId: "p-reject",
    setRejectOpen: vi.fn(),
    revisionOpen: routeState.revisionOpen,
    revisionProposalId: "p-revision",
    revisionInitialValues: null,
    revisionProposalDetailQuery: { data: null, isLoading: false },
    handleRevisionDialogOpenChange: vi.fn(),
    proposalComposerOpen: false,
    setProposalComposerOpen: vi.fn(),
    proposalComposerMode: "create",
    proposalComposerInitialProposal: null,
    openProposalComposerCreate: openProposalComposerCreateMock,
    openProposalComposerEdit: openProposalComposerEditMock,
    detailsDialogOpen: routeState.detailsDialogOpen,
    detailsProposalId: "p-details",
    proposalDetailQuery: {
      data: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    },
    openProposalDetails: openProposalDetailsMock,
    handleDetailsDialogOpenChange: vi.fn(),
    handleProposalAction: handleProposalActionMock,
  }),
}));

vi.mock("@/features/service-reschedule", () => ({
  useChatRescheduleDialogs: () => ({
    proposeOpen: routeState.proposeOpen,
    setProposeOpen: vi.fn(),
    acceptOpen: routeState.acceptRescheduleOpen,
    setAcceptOpen: vi.fn(),
    adjustmentOpen: routeState.adjustmentOpen,
    setAdjustmentOpen: vi.fn(),
    cancelOpen: routeState.cancelOpen,
    setCancelOpen: vi.fn(),
    activeRequestId: "req-1",
    handleRescheduleAction: handleRescheduleActionMock,
    openProposeDialog: openProposeDialogMock,
  }),
  AcceptRescheduleDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="accept-reschedule-dialog" /> : null,
  CancelRescheduleDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="cancel-reschedule-dialog" /> : null,
  ProposeRescheduleDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="propose-reschedule-dialog" /> : null,
  RequestAdjustmentRescheduleDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="adjustment-reschedule-dialog" /> : null,
}));

vi.mock("@/features/negotiation-proposals", () => ({
  AcceptProposalDialog: () => <div data-testid="accept-proposal-dialog" />,
  RejectProposalDialog: () => <div data-testid="reject-proposal-dialog" />,
  RevisionRequestDialog: () => <div data-testid="revision-dialog" />,
  ProposalComposerDialog: () => <div data-testid="proposal-composer-dialog" />,
  ProposalDetailsDialog: () => <div data-testid="proposal-details-dialog" />,
  canEditServiceRequestProposal: () => false,
}));

vi.mock("../../ChatScreen/ChatScreen", () => ({
  ChatScreen: ({
    chatId,
    onBack,
    onDetails,
    onBannerCta,
    onProposalAction,
    onRescheduleAction,
  }: {
    chatId: string;
    onBack: () => void;
    onDetails: () => void;
    onBannerCta: (payload: { action: string; proposalId?: string; rescheduleRequestId?: string }) => void;
    onProposalAction: (action: string, proposalId: string) => void;
    onRescheduleAction: (action: string, requestId: string) => void;
  }) => (
    <div data-testid="chat-screen">
      <span>{chatId}</span>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button type="button" onClick={onDetails}>
        Open details
      </button>
      <button
        type="button"
        onClick={() => onBannerCta({ action: "close_conversation" })}
      >
        Banner close
      </button>
      <button
        type="button"
        onClick={() => onBannerCta({ action: "send_proposal" })}
      >
        Banner send proposal
      </button>
      <button
        type="button"
        onClick={() => onBannerCta({ action: "review_proposal", proposalId: "p1" })}
      >
        Banner review
      </button>
      <button
        type="button"
        onClick={() => onBannerCta({ action: "view_proposal", proposalId: "p2" })}
      >
        Banner view
      </button>
      <button
        type="button"
        onClick={() =>
          onBannerCta({ action: "propose_reschedule", rescheduleRequestId: "req-9" })
        }
      >
        Banner reschedule
      </button>
      <button type="button" onClick={() => onProposalAction("accept", "p3")}>
        Proposal action
      </button>
      <button type="button" onClick={() => onRescheduleAction("accept", "req-2")}>
        Reschedule action
      </button>
    </div>
  ),
}));

vi.mock("../../ChatDetails/ChatDetailsDesktopPanel", () => ({
  ChatDetailsDesktopPanel: ({
    onClose,
    onArchive,
    onViewProposalDetails,
  }: {
    onClose: () => void;
    onArchive: () => void;
    onViewProposalDetails: (id: string) => void;
  }) => (
    <aside data-testid="details-desktop">
      <button type="button" onClick={onClose}>
        Close panel
      </button>
      <button type="button" onClick={onArchive}>
        Archive
      </button>
      <button type="button" onClick={() => onViewProposalDetails("p-view")}>
        View proposal
      </button>
    </aside>
  ),
}));

vi.mock("../../ChatDetails/ChatDetailsMobileSheet", () => ({
  ChatDetailsMobileSheet: ({
    open,
    onArchive,
  }: {
    open: boolean;
    onArchive: () => void;
  }) =>
    open ? (
      <div data-testid="details-mobile">
        <button type="button" onClick={onArchive}>
          Archive mobile
        </button>
      </div>
    ) : null,
}));

vi.mock("../../ChatDetails/ChatDetailsActions", () => ({
  CloseConversationConfirmDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="close-confirm">
        <button type="button" onClick={onConfirm}>
          Confirm close
        </button>
      </div>
    ) : null,
}));

const detail: ConversationDetailResponse = {
  conversation: {
    id: "chat-1",
    service_request_id: "sr-1",
    client_id: "client-1",
    provider_id: "provider-1",
    status: "ACTIVE",
    last_interaction_at: "2026-06-01T12:00:00Z",
    activated_at: "2026-06-01T10:00:00Z",
    inactivated_at: null,
    inactivation_reason: null,
    closed_at: null,
    closure_type: null,
    created_at: "2026-06-01T09:00:00Z",
    updated_at: "2026-06-01T12:00:00Z",
  },
  counterparty: {
    id: "provider-1",
    full_name: "João Prestador",
    profile_image_path: null,
    role: "provider",
  },
  service_request: {
    id: "sr-1",
    title: "Trocar tomada",
  },
  service: {
    id: "service-1",
    title: "Eletricista",
    slug: "eletricista",
    icon_key: null,
    color_key: null,
    image_url: null,
  },
  category: null,
  counterparty_read_receipt: null,
  accepted_proposal: null,
};

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={[`/chats/${routeState.chatId ?? ""}`]}>
      <Routes>
        <Route path="/chats/:chatId" element={<ChatsConversationRoute />} />
        <Route path="/chats" element={<ChatsConversationRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChatsConversationRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.chatId = "chat-1";
    routeState.showDetailsColumn = false;
    routeState.profile = {
      id: "client-1",
      role: "client",
      full_name: "Maria Cliente",
      profile_image_path: null,
    };
    routeState.detail = detail;
    routeState.acceptOpen = false;
    routeState.rejectOpen = false;
    routeState.revisionOpen = false;
    routeState.detailsDialogOpen = false;
    routeState.proposeOpen = false;
    routeState.acceptRescheduleOpen = false;
    routeState.adjustmentOpen = false;
    routeState.cancelOpen = false;
    routeState.closePending = false;
  });

  it("renders nothing without a chatId param", () => {
    routeState.chatId = undefined;
    const { container } = renderRoute();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders chat screen and navigates back to list with search", () => {
    renderRoute();

    expect(screen.getByTestId("chat-screen")).toHaveTextContent("chat-1");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(navigateMock).toHaveBeenCalledWith("/dashboard/chats?from=list");
  });

  it("routes banner CTAs to the matching dialogs and actions", () => {
    renderRoute();

    fireEvent.click(screen.getByRole("button", { name: "Banner close" }));
    expect(screen.getByTestId("close-confirm")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Banner send proposal" }));
    expect(openProposalComposerCreateMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Banner review" }));
    expect(openProposalComposerEditMock).toHaveBeenCalledWith("p1");

    fireEvent.click(screen.getByRole("button", { name: "Banner view" }));
    expect(openProposalDetailsMock).toHaveBeenCalledWith("p2");

    fireEvent.click(screen.getByRole("button", { name: "Banner reschedule" }));
    expect(openProposeDialogMock).toHaveBeenCalledWith("req-9");
  });

  it("forwards proposal and reschedule card actions", () => {
    renderRoute();

    fireEvent.click(screen.getByRole("button", { name: "Proposal action" }));
    expect(handleProposalActionMock).toHaveBeenCalledWith("accept", "p3");

    fireEvent.click(screen.getByRole("button", { name: "Reschedule action" }));
    expect(handleRescheduleActionMock).toHaveBeenCalledWith("accept", "req-2");
  });

  it("opens mobile details sheet and archives via confirm dialog", () => {
    renderRoute();

    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(screen.getByTestId("details-mobile")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Archive mobile" }));
    expect(screen.getByTestId("close-confirm")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm close" }));
    expect(mutateCloseMock).toHaveBeenCalled();
    const [, options] = mutateCloseMock.mock.calls[0]!;
    act(() => {
      options.onSuccess();
    });
    expect(screen.queryByTestId("close-confirm")).toBeNull();
    expect(screen.queryByTestId("details-mobile")).toBeNull();
  });

  it("shows desktop details panel when the details column is available", () => {
    routeState.showDetailsColumn = true;
    renderRoute();

    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(screen.getByTestId("details-desktop")).toBeInTheDocument();
    expect(screen.queryByTestId("details-mobile")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View proposal" }));
    expect(openProposalDetailsMock).toHaveBeenCalledWith("p-view");

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(screen.queryByTestId("details-desktop")).toBeNull();
  });

  it("mounts proposal and reschedule dialogs when their open flags are set", () => {
    routeState.acceptOpen = true;
    routeState.rejectOpen = true;
    routeState.revisionOpen = true;
    routeState.detailsDialogOpen = true;
    routeState.proposeOpen = true;
    routeState.acceptRescheduleOpen = true;
    routeState.adjustmentOpen = true;
    routeState.cancelOpen = true;

    renderRoute();

    expect(screen.getByTestId("accept-proposal-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("reject-proposal-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("revision-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-details-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("propose-reschedule-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("accept-reschedule-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("adjustment-reschedule-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-reschedule-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-composer-dialog")).toBeInTheDocument();
  });
});
