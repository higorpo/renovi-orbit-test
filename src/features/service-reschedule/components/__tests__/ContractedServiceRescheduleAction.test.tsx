import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractedServiceRescheduleAction } from "../ContractedServiceRescheduleAction";
import type { ServiceRescheduleSnapshot } from "../../types/serviceReschedule.types";

const navigateMock = vi.fn();
const dialogChatIdRef = vi.hoisted(() => ({ value: "chat-from-dialog" as string | null }));

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../RequestRescheduleDialog", () => ({
  RequestRescheduleDialog: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess?: (chatId: string | null) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onSuccess?.(dialogChatIdRef.value)}>
        Mock request dialog
      </button>
    ) : null,
}));

const baseSnapshot: ServiceRescheduleSnapshot = {
  contractedServiceId: "cs-1",
  durationUnit: "hours",
  durationValue: 4,
  activeRequest: null,
  displayStatus: null,
  canClientRequestReschedule: true,
  canProviderRequestReschedule: false,
  canProposeReschedule: false,
  canAcceptReschedule: false,
  canRequestAdjustment: false,
  canCancelReschedule: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  dialogChatIdRef.value = "chat-from-dialog";
});

describe("ContractedServiceRescheduleAction", () => {
  it("renders nothing when viewer cannot request and there is no active request", () => {
    const { container } = render(
      <ContractedServiceRescheduleAction
        contractedServiceId="cs-1"
        chatId="chat-1"
        viewerRole="client"
        reschedule={{ ...baseSnapshot, canClientRequestReschedule: false }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("opens request dialog for clients who can request reschedule", () => {
    render(
      <ContractedServiceRescheduleAction
        contractedServiceId="cs-1"
        chatId="chat-1"
        viewerRole="client"
        reschedule={baseSnapshot}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Solicitar reagendamento/i }));
    expect(screen.getByRole("button", { name: "Mock request dialog" })).toBeInTheDocument();
  });

  it("navigates to chat when an active request exists", () => {
    render(
      <ContractedServiceRescheduleAction
        contractedServiceId="cs-1"
        chatId="chat-fallback"
        viewerRole="provider"
        reschedule={{
          ...baseSnapshot,
          canClientRequestReschedule: false,
          canProviderRequestReschedule: false,
          activeRequest: {
            id: "req-1",
            status: "REQUESTED",
            requested_by_role: "client",
            requested_by_profile_id: "p-1",
            request_note: null,
            original_slot: { start_date: "2030-06-10", shift: "morning" },
            original_service_execution_at: "2030-06-10T12:00:00.000Z",
            proposed_slot: null,
            proposed_at: null,
            adjustment_count: 0,
            is_last_minute: false,
            chat_id: "chat-active",
            parent_request_id: null,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ver pedido de reagendamento no chat/i }));
    expect(navigateMock).toHaveBeenCalledWith("/dashboard/chats/chat-active");
  });

  it("does not navigate when active request has no resolvable chat id", () => {
    render(
      <ContractedServiceRescheduleAction
        contractedServiceId="cs-1"
        chatId={null}
        viewerRole="provider"
        reschedule={{
          ...baseSnapshot,
          canClientRequestReschedule: false,
          canProviderRequestReschedule: false,
          activeRequest: {
            id: "req-1",
            status: "REQUESTED",
            requested_by_role: "client",
            requested_by_profile_id: "p-1",
            request_note: null,
            original_slot: { start_date: "2030-06-10", shift: "morning" },
            original_service_execution_at: "2030-06-10T12:00:00.000Z",
            proposed_slot: null,
            proposed_at: null,
            adjustment_count: 0,
            is_last_minute: false,
            chat_id: "",
            parent_request_id: null,
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ver pedido de reagendamento no chat/i }));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates after successful request when dialog reports a chat id", () => {
    const onSuccess = vi.fn();

    render(
      <ContractedServiceRescheduleAction
        contractedServiceId="cs-1"
        chatId="chat-1"
        viewerRole="client"
        reschedule={baseSnapshot}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Solicitar reagendamento/i }));
    fireEvent.click(screen.getByRole("button", { name: "Mock request dialog" }));

    expect(onSuccess).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/dashboard/chats/chat-from-dialog");
  });

  it("calls onSuccess without navigating when dialog returns no chat id", () => {
    dialogChatIdRef.value = null;
    const onSuccess = vi.fn();

    render(
      <ContractedServiceRescheduleAction
        contractedServiceId="cs-1"
        chatId="chat-1"
        viewerRole="client"
        reschedule={baseSnapshot}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Solicitar reagendamento/i }));
    fireEvent.click(screen.getByRole("button", { name: "Mock request dialog" }));

    expect(onSuccess).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
