// @vitest-environment happy-dom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationDetailResponse } from "../../../types/chats.types";
import { ChatScreen } from "../ChatScreen";

const navigateMock = vi.fn();
const refetchDetailMock = vi.fn();
const refetchMessagesMock = vi.fn();
const refetchGapFillMock = vi.fn();
const fetchNextPageMock = vi.fn();
const sendChatMessageMock = vi.fn();
const sendChatImagesMock = vi.fn();
const sendChatAudioMock = vi.fn();
const notifyComposerChangeMock = vi.fn();
const notifyTypingStopNowMock = vi.fn();
const dismissBannerMock = vi.fn();
const getCtaPayloadMock = vi.fn();

const authState = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profile: { id: "user-1", role: "client" as const, full_name: "Maria" },
}));

const detailState = vi.hoisted(() => ({
  detail: null as ConversationDetailResponse | null,
  isLoading: false,
  isError: false,
  error: null as Error | null,
}));

const messagesState = vi.hoisted(() => ({
  messages: [] as Array<{
    id: string;
    chat_id: string;
    sender_user_id: string;
    message_type: string;
    payload: Record<string, unknown>;
    linked_entity_type: string | null;
    linked_entity_id: string | null;
    idempotency_key: string;
    delivery_status: string;
    created_at: string;
    updated_at: string;
  }>,
  isLoading: false,
  isError: false,
  error: null as Error | null,
  hasNextPage: false,
  isFetchingNextPage: false,
}));

const bannerState = vi.hoisted(() => ({
  banner: null as {
    body: string;
    ctaLabel: string;
    ctaAriaLabel: string;
    dismissAriaLabel: string;
  } | null,
  isVisible: false,
}));

const typingState = vi.hoisted(() => ({
  isCounterpartyTyping: false,
}));

const moderationState = vi.hoisted(() => ({
  allowed: true,
  message: null as string | null,
}));

const breakpointState = vi.hoisted(() => ({
  isDesktop: true,
}));

const keyboardState = vi.hoisted(() => ({
  isVisible: false,
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    user: authState.user,
    profile: authState.profile,
  }),
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => breakpointState.isDesktop,
}));

vi.mock("@/hooks/useVirtualKeyboardVisible", () => ({
  useVirtualKeyboardVisible: () => keyboardState.isVisible,
}));

vi.mock("@/features/service-reschedule", () => ({
  useActiveChatReschedule: () => ({ snapshot: null }),
}));

vi.mock("@/features/negotiation-proposals", () => ({
  isPendingProposalStatus: (status: string | null) => status === "PENDING",
}));

vi.mock("../../../hooks/useConversationDetail", () => ({
  useConversationDetail: () => ({
    detail: detailState.detail,
    isLoading: detailState.isLoading,
    isError: detailState.isError,
    error: detailState.error,
    refetch: refetchDetailMock,
  }),
}));

vi.mock("../../../hooks/useChatMessages", () => ({
  useChatMessages: () => ({
    messages: messagesState.messages,
    isLoading: messagesState.isLoading,
    isError: messagesState.isError,
    error: messagesState.error,
    hasNextPage: messagesState.hasNextPage,
    isFetchingNextPage: messagesState.isFetchingNextPage,
    fetchNextPage: fetchNextPageMock,
    refetch: refetchMessagesMock,
    refetchGapFill: refetchGapFillMock,
    sendChatMessage: sendChatMessageMock,
    sendChatImages: sendChatImagesMock,
    sendChatAudio: sendChatAudioMock,
  }),
}));

vi.mock("../../../hooks/useMarkConversationRead", () => ({
  useMarkConversationRead: vi.fn(),
}));

vi.mock("../../../hooks/useChatSentryContext", () => ({
  useChatSentryContext: vi.fn(),
}));

vi.mock("../../../hooks/usePushNotificationSuppression", () => ({
  usePushNotificationSuppression: vi.fn(),
}));

vi.mock("../../../hooks/useConversationRealtime", () => ({
  useConversationRealtime: vi.fn(),
  isRealtimeConnectionHealthy: (status: string) => status === "SUBSCRIBED",
}));

vi.mock("../../../hooks/useConversationPollingFallback", () => ({
  useConversationPollingFallback: vi.fn(),
}));

vi.mock("../../../hooks/useConversationTypingPresence", () => ({
  useConversationTypingPresence: () => ({
    isCounterpartyTyping: typingState.isCounterpartyTyping,
    notifyComposerChange: notifyComposerChangeMock,
    notifyTypingStopNow: notifyTypingStopNowMock,
  }),
}));

vi.mock("../../../hooks/useChatComposerState", () => ({
  useChatComposerState: () => ({
    isInputEnabled: true,
    isAttachmentEnabled: true,
    isSendEnabled: true,
    disabledReason: null,
    helperText: null,
    placeholder: "Escreva uma mensagem…",
  }),
}));

vi.mock("../../../hooks/useProposalTimelineHydration", () => ({
  useProposalTimelineHydration: () => ({
    proposal: null,
    isLoading: false,
  }),
}));

vi.mock("../../../hooks/useChatActionBannerState", () => ({
  useChatActionBannerState: () => ({
    banner: bannerState.banner,
    isVisible: bannerState.isVisible,
    dismiss: dismissBannerMock,
    getCtaPayload: getCtaPayloadMock,
  }),
}));

vi.mock("../../../hooks/useChatActionBannerInset", () => ({
  useChatActionBannerInset: () => 0,
}));

vi.mock("../../../utils/moderateChatComposerSend", () => ({
  moderateChatComposerSend: () => ({
    allowed: moderationState.allowed,
    violation: moderationState.allowed ? null : "blocked",
    message: moderationState.message,
  }),
}));

vi.mock("../../../utils/clientSendId", () => ({
  createClientSendId: () => "client-send-1",
}));

vi.mock("../ChatTimeline", () => ({
  ChatTimeline: ({
    isError,
    errorMessage,
    onRetry,
  }: {
    isError: boolean;
    errorMessage?: string;
    onRetry?: () => void;
  }) =>
    isError ? (
      <div>
        <p>{errorMessage ?? "timeline error"}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry}>
            Retry timeline
          </button>
        ) : null}
      </div>
    ) : (
      <div data-testid="chat-timeline">Timeline</div>
    ),
}));

vi.mock("../ChatComposerBar", () => ({
  ChatComposerBar: ({
    onSend,
    onSendAudio,
    onComposerChange,
    sendBlockMessage,
  }: {
    onSend: (payload: { text: string; files: File[] }) => void;
    onSendAudio?: (payload: { file: File; durationMs: number }) => void;
    onComposerChange?: () => void;
    sendBlockMessage?: string | null;
  }) => (
    <div data-testid="chat-composer">
      {sendBlockMessage ? <p role="alert">{sendBlockMessage}</p> : null}
      <button
        type="button"
        onClick={() => onSend({ text: "Olá", files: [] })}
      >
        Send text
      </button>
      <button
        type="button"
        onClick={() =>
          onSend({
            text: "Com foto",
            files: [new File(["x"], "a.jpg", { type: "image/jpeg" })],
          })
        }
      >
        Send images
      </button>
      <button
        type="button"
        onClick={() =>
          onSendAudio?.({
            file: new File(["a"], "voice.webm", { type: "audio/webm" }),
            durationMs: 1200,
          })
        }
      >
        Send audio
      </button>
      <button type="button" onClick={() => onComposerChange?.()}>
        Composer change
      </button>
    </div>
  ),
}));

vi.mock("../ChatScreenHeader", () => ({
  ChatScreenHeader: ({
    counterpartyName,
    serviceTitle,
    onBack,
    onDetails,
  }: {
    counterpartyName: string;
    serviceTitle: string;
    onBack: () => void;
    onDetails?: () => void;
  }) => (
    <header>
      <h1>{counterpartyName}</h1>
      <p>{serviceTitle}</p>
      <button type="button" onClick={onBack}>
        Voltar
      </button>
      {onDetails ? (
        <button type="button" onClick={onDetails}>
          Detalhes
        </button>
      ) : null}
    </header>
  ),
}));

vi.mock("../ChatScreenSkeleton", () => ({
  ChatScreenSkeleton: ({ className }: { className?: string }) => (
    <div data-testid="chat-screen-skeleton" className={className}>
      Loading
    </div>
  ),
}));

vi.mock("../../ChatActionBanner/ChatActionBanner", () => ({
  ChatActionBanner: ({
    banner,
    onDismiss,
    onPrimaryAction,
  }: {
    banner: { body: string; ctaLabel: string; ctaAriaLabel: string; dismissAriaLabel: string };
    onDismiss: () => void;
    onPrimaryAction: () => void;
  }) => (
    <section>
      <p>{banner.body}</p>
      <button type="button" onClick={onDismiss} aria-label={banner.dismissAriaLabel}>
        Dispensar
      </button>
      <button type="button" onClick={onPrimaryAction} aria-label={banner.ctaAriaLabel}>
        {banner.ctaLabel}
      </button>
    </section>
  ),
}));

vi.mock("../../ChatActionBanner/ChatActionBannerOverlay", () => ({
  ChatActionBannerOverlayHost: React.forwardRef<
    HTMLDivElement,
    { show: boolean; isDisplayed: boolean; children: React.ReactNode }
  >(function Host({ show, isDisplayed, children }, ref) {
    if (!show || !isDisplayed) return null;
    return (
      <div ref={ref} data-testid="banner-overlay">
        {children}
      </div>
    );
  }),
}));

const baseDetail: ConversationDetailResponse = {
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

function renderScreen(props: Partial<React.ComponentProps<typeof ChatScreen>> = {}) {
  return render(
    <MemoryRouter>
      <ChatScreen chatId="chat-1" {...props} />
    </MemoryRouter>,
  );
}

describe("ChatScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "user-1" };
    authState.profile = { id: "user-1", role: "client", full_name: "Maria" };
    detailState.detail = baseDetail;
    detailState.isLoading = false;
    detailState.isError = false;
    detailState.error = null;
    messagesState.messages = [];
    messagesState.isLoading = false;
    messagesState.isError = false;
    messagesState.error = null;
    messagesState.hasNextPage = false;
    messagesState.isFetchingNextPage = false;
    bannerState.banner = null;
    bannerState.isVisible = false;
    typingState.isCounterpartyTyping = false;
    moderationState.allowed = true;
    moderationState.message = null;
    breakpointState.isDesktop = true;
    keyboardState.isVisible = false;
  });

  it("shows skeleton while conversation detail is loading", () => {
    detailState.isLoading = true;
    detailState.detail = null;

    renderScreen();

    expect(screen.getByTestId("chat-screen-skeleton")).toBeInTheDocument();
  });

  it("shows detail error with retry action", () => {
    detailState.detail = null;
    detailState.isError = true;
    detailState.error = new Error("Falha ao carregar conversa");

    renderScreen();

    expect(screen.getByText("Falha ao carregar conversa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetchDetailMock).toHaveBeenCalledTimes(1);
  });

  it("shows fallback detail error when error is not an Error instance", () => {
    detailState.detail = null;
    detailState.isError = true;
    detailState.error = null;

    renderScreen();

    expect(
      screen.getByText("Não foi possível abrir esta conversa."),
    ).toBeInTheDocument();
  });

  it("renders header, timeline and composer for a loaded conversation", () => {
    renderScreen();

    expect(screen.getByRole("heading", { name: "João Prestador" })).toBeInTheDocument();
    expect(screen.getByText("Trocar tomada")).toBeInTheDocument();
    expect(screen.getByTestId("chat-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("chat-composer")).toBeInTheDocument();
  });

  it("uses fallback labels when counterparty and service titles are missing", () => {
    detailState.detail = {
      ...baseDetail,
      counterparty: { ...baseDetail.counterparty, full_name: "   " },
      service_request: { ...baseDetail.service_request, title: "" },
      service: { ...baseDetail.service!, title: "" },
    };

    renderScreen();

    expect(screen.getByRole("heading", { name: "Participante" })).toBeInTheDocument();
    expect(screen.getByText("Serviço")).toBeInTheDocument();
  });

  it("calls onBack when provided and navigates back otherwise", () => {
    const onBack = vi.fn();
    const { rerender } = renderScreen({ onBack });

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();

    rerender(
      <MemoryRouter>
        <ChatScreen chatId="chat-1" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it("forwards details click to onDetails", () => {
    const onDetails = vi.fn();
    renderScreen({ onDetails });

    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it("shows typing indicator when counterparty is typing", () => {
    typingState.isCounterpartyTyping = true;
    renderScreen();

    expect(screen.getByText("João Prestador está digitando…")).toBeInTheDocument();
  });

  it("renders action banner and forwards CTA payload", () => {
    bannerState.banner = {
      body: "Envie uma proposta",
      ctaLabel: "Enviar proposta",
      ctaAriaLabel: "Enviar proposta",
      dismissAriaLabel: "Dispensar banner",
    };
    bannerState.isVisible = true;
    getCtaPayloadMock.mockReturnValue({ action: "send_proposal" });
    const onBannerCta = vi.fn();

    renderScreen({ onBannerCta });

    expect(screen.getByText("Envie uma proposta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));
    expect(onBannerCta).toHaveBeenCalledWith({ action: "send_proposal" });

    fireEvent.click(screen.getByRole("button", { name: "Dispensar banner" }));
    expect(dismissBannerMock).toHaveBeenCalledTimes(1);
  });

  it("sends text messages through the messages hook", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Send text" }));

    expect(sendChatMessageMock).toHaveBeenCalledWith({
      messageType: "TEXT",
      payload: { text: "Olá" },
      clientSendId: "client-send-1",
    });
  });

  it("sends images with caption and skips plain text send", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Send images" }));

    expect(sendChatImagesMock).toHaveBeenCalledWith(
      [expect.any(File)],
      "Com foto",
    );
    expect(sendChatMessageMock).not.toHaveBeenCalled();
  });

  it("forwards audio recordings to sendChatAudio", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Send audio" }));

    expect(sendChatAudioMock).toHaveBeenCalledWith(expect.any(File), 1200);
  });

  it("blocks moderated text and clears the block on composer change", () => {
    moderationState.allowed = false;
    moderationState.message = "Mensagem bloqueada";

    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Send text" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem bloqueada");
    expect(sendChatMessageMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Composer change" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(notifyComposerChangeMock).toHaveBeenCalled();
  });

  it("clears send block message when chatId changes", () => {
    moderationState.allowed = false;
    moderationState.message = "Mensagem bloqueada";

    const { rerender } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Send text" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Mensagem bloqueada");

    rerender(
      <MemoryRouter>
        <ChatScreen chatId="chat-2" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hides action banner overlay when mobile keyboard is open", () => {
    bannerState.banner = {
      body: "Envie uma proposta",
      ctaLabel: "Enviar proposta",
      ctaAriaLabel: "Enviar proposta",
      dismissAriaLabel: "Dispensar banner",
    };
    bannerState.isVisible = true;
    breakpointState.isDesktop = false;
    keyboardState.isVisible = true;

    const { rerender } = renderScreen();

    expect(screen.queryByTestId("banner-overlay")).toBeNull();

    keyboardState.isVisible = false;
    rerender(
      <MemoryRouter>
        <ChatScreen chatId="chat-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("banner-overlay")).toBeInTheDocument();
    expect(screen.getByText("Envie uma proposta")).toBeInTheDocument();
  });

  it("uses provider viewer role from profile", () => {
    authState.profile = { id: "user-1", role: "provider", full_name: "João" };
    renderScreen();

    expect(screen.getByTestId("chat-timeline")).toBeInTheDocument();
  });

  it("shows message errors and retries the timeline query", () => {
    messagesState.isError = true;
    messagesState.error = new Error("Falha ao carregar mensagens");

    renderScreen();

    expect(screen.getByText("Falha ao carregar mensagens")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry timeline" }));
    expect(refetchMessagesMock).toHaveBeenCalledTimes(1);
  });

  it("omits a timeline error message for non-Error failures", () => {
    messagesState.isError = true;
    messagesState.error = "offline" as unknown as Error;

    renderScreen();

    expect(screen.getByText("timeline error")).toBeInTheDocument();
  });

  it("uses the service title when the request title is empty", () => {
    detailState.detail = {
      ...baseDetail,
      service_request: { ...baseDetail.service_request, title: "" },
      service: { ...baseDetail.service!, title: "Instalação elétrica" },
    };

    renderScreen();

    expect(screen.getByText("Instalação elétrica")).toBeInTheDocument();
  });

  it("does not invoke the banner callback when the CTA payload is missing", () => {
    bannerState.banner = {
      body: "Envie uma proposta",
      ctaLabel: "Enviar proposta",
      ctaAriaLabel: "Enviar proposta",
      dismissAriaLabel: "Dispensar banner",
    };
    bannerState.isVisible = true;
    getCtaPayloadMock.mockReturnValue(null);
    const onBannerCta = vi.fn();

    renderScreen({ onBannerCta });
    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));

    expect(onBannerCta).not.toHaveBeenCalled();
  });

  it("allows a banner CTA without an external callback", () => {
    bannerState.banner = {
      body: "Envie uma proposta",
      ctaLabel: "Enviar proposta",
      ctaAriaLabel: "Enviar proposta",
      dismissAriaLabel: "Dispensar banner",
    };
    bannerState.isVisible = true;
    getCtaPayloadMock.mockReturnValue({ action: "send_proposal" });

    renderScreen();

    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" })),
    ).not.toThrow();
  });

  it("shows the fallback error when detail is absent without a query error", () => {
    detailState.detail = null;
    detailState.isError = false;

    renderScreen();

    expect(
      screen.getByText("Não foi possível abrir esta conversa."),
    ).toBeInTheDocument();
  });

  it("reconciles realtime and polling events through gap fill", async () => {
    const { act } = await import("@testing-library/react");
    const { useConversationRealtime } = await import(
      "../../../hooks/useConversationRealtime"
    );
    const { useConversationPollingFallback } = await import(
      "../../../hooks/useConversationPollingFallback"
    );
    let reconcile: (() => void) | undefined;
    let changeStatus: ((status: string) => void) | undefined;
    let poll: (() => void) | undefined;

    vi.mocked(useConversationRealtime).mockImplementation((_chatId, options) => {
      reconcile = options.onReconcile;
      changeStatus = options.onRealtimeStatusChange;
    });
    vi.mocked(useConversationPollingFallback).mockImplementation((options) => {
      poll = options.onPoll;
    });

    renderScreen();
    act(() => {
      reconcile?.();
      poll?.();
      changeStatus?.("CHANNEL_ERROR");
    });

    expect(refetchGapFillMock).toHaveBeenCalledTimes(2);
    expect(useConversationPollingFallback).toHaveBeenLastCalledWith(
      expect.objectContaining({ realtimeHealthy: false }),
    );
  });
});
