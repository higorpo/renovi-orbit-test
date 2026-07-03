/**
 * CNS chat RPC mocks for Playwright (task 106).
 * Intercepts PostgREST rpc/* calls used by the chats feature.
 */
import type { Page } from "@playwright/test";
import type { ChatMessageListItem } from "../../src/features/chats/types/chats.types";

export const E2E_CHAT_ID = "chat-e2e-1";
export const E2E_SR_ID = "sr-e2e-1";
export const E2E_PROPOSAL_ID = "prop-e2e-1";
export const E2E_CLIENT_ID = "client-e2e-uuid";
export const E2E_PROVIDER_ID = "provider-e2e-uuid";

export interface ChatsMockOptions {
  viewerUserId: string;
  viewerRole: "client" | "provider";
  /** When true, timeline includes a PENDING proposal message. */
  withPendingProposal?: boolean;
  /** When true, accept flow requires payment checkout (Task 95). */
  withPaymentCheckout?: boolean;
}

function baseConversation() {
  return {
    id: E2E_CHAT_ID,
    service_request_id: E2E_SR_ID,
    client_id: E2E_CLIENT_ID,
    provider_id: E2E_PROVIDER_ID,
    status: "ACTIVE",
    last_interaction_at: new Date().toISOString(),
    activated_at: new Date().toISOString(),
    inactivated_at: null,
    closed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function counterpartyFor(role: "client" | "provider") {
  if (role === "client") {
    return {
      id: E2E_PROVIDER_ID,
      full_name: "Prestador E2E",
      profile_image_path: null,
      role: "provider" as const,
    };
  }
  return {
    id: E2E_CLIENT_ID,
    full_name: "Cliente E2E",
    profile_image_path: null,
    role: "client" as const,
  };
}

function listItem(viewerRole: "client" | "provider") {
  return {
    ...baseConversation(),
    counterparty: counterpartyFor(viewerRole),
    service_request_title: "Pintura sala",
    service: {
      id: "svc-1",
      title: "Pintura",
      slug: "pintura",
      icon_key: null,
      color_key: null,
      image_url: null,
    },
    last_message: {
      id: "msg-1",
      message_type: "TEXT",
      created_at: new Date().toISOString(),
      preview_text: "Olá",
      linked_entity_type: null,
      linked_entity_id: null,
    },
    is_unread: false,
    last_read_at: new Date().toISOString(),
  };
}

function initialMessages(withProposal: boolean): ChatMessageListItem[] {
  const messages: ChatMessageListItem[] = [
    {
      id: "msg-1",
      chat_id: E2E_CHAT_ID,
      sender_user_id: E2E_PROVIDER_ID,
      message_type: "TEXT",
      payload: { text: "Olá, posso ajudar com o serviço." },
      linked_entity_type: null,
      linked_entity_id: null,
      idempotency_key: "idem-1",
      delivery_status: "SENT",
      created_at: "2026-05-30T10:00:00.000Z",
      updated_at: "2026-05-30T10:00:00.000Z",
    },
  ];

  if (withProposal) {
    messages.push({
      id: "msg-prop-1",
      chat_id: E2E_CHAT_ID,
      sender_user_id: E2E_PROVIDER_ID,
      message_type: "PROPOSAL",
      payload: {},
      linked_entity_type: "proposal",
      linked_entity_id: E2E_PROPOSAL_ID,
      idempotency_key: "idem-prop",
      delivery_status: "SENT",
      created_at: "2026-05-30T11:00:00.000Z",
      updated_at: "2026-05-30T11:00:00.000Z",
    });
  }

  return messages;
}

function proposalDetailRow(withPaymentCheckout = false) {
  return {
    id: E2E_PROPOSAL_ID,
    service_request_id: E2E_SR_ID,
    provider_id: E2E_PROVIDER_ID,
    status: "PENDING",
    version: 1,
    revision_count: 0,
    revision_reason: null,
    revision_notes: null,
    submitted_at: "2026-07-03T10:00:00.000Z",
    expired_at: null,
    proposed_amount: 450,
    tax_rate: 0,
    tax_amount: 0,
    final_amount: 450,
    pricing_signature: withPaymentCheckout ? "pricing-sig-e2e" : null,
    proposal_description: "Pintura completa com material incluso.",
    proposal_duration_unit: "hours",
    proposal_duration_value: 4,
    proposal_suggested_slots: withPaymentCheckout
      ? [{
        start_date: "2026-07-10",
        end_date: "2026-07-10",
        shift: "morning",
      }]
      : [],
    selected_slot: null,
    photos: [],
    client_rejection_response: null,
    created_at: "2026-05-30T11:00:00.000Z",
    updated_at: "2026-05-30T11:00:00.000Z",
  };
}

export async function installChatsMocks(page: Page, options: ChatsMockOptions) {
  const messages = initialMessages(options.withPendingProposal ?? false);
  const capturedRpc: Record<string, unknown[]> = {
    sendMessage: [],
    acceptProposal: [],
  };
  const withPaymentCheckout = options.withPaymentCheckout ?? false;

  await page.route(/\/rest\/v1\/provider_proposals/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const idFilter = url.searchParams.get("id");
    if (idFilter !== `eq.${E2E_PROPOSAL_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([proposalDetailRow(withPaymentCheckout)]),
    });
  });

  await page.route(/\/rest\/v1\/rpc\//, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const rpcName = url.pathname.split("/").pop() ?? "";
    const body = route.request().postDataJSON() as Record<string, unknown>;

    switch (rpcName) {
      case "list_conversations":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [listItem(options.viewerRole)],
            has_more: false,
            next_cursor: null,
          }),
        });
        return;

      case "get_conversation_detail":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            conversation: baseConversation(),
            counterparty: counterpartyFor(options.viewerRole),
            service_request: {
              id: E2E_SR_ID,
              title: "Pintura sala",
            },
            service: {
              id: "svc-1",
              title: "Pintura",
              slug: "pintura",
              icon_key: null,
              color_key: null,
              image_url: null,
            },
            category: null,
            counterparty_read_receipt: null,
            accepted_proposal: null,
          }),
        });
        return;

      case "list_chat_messages":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [...messages],
            has_more: false,
            next_cursor: null,
          }),
        });
        return;

      case "cns_chat_free_messaging_allowed":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(true),
        });
        return;

      case "cns_send_message": {
        capturedRpc.sendMessage.push(body);
        const text =
          (body.p_payload as { text?: string } | undefined)?.text ?? "Nova mensagem";
        const newMessage = {
          id: `msg-${messages.length + 1}`,
          chat_id: E2E_CHAT_ID,
          sender_user_id: options.viewerUserId,
          message_type: "TEXT",
          payload: { text },
          linked_entity_type: null,
          linked_entity_id: null,
          idempotency_key: String(body.p_idempotency_key ?? "new-idem"),
          delivery_status: "SENT",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        messages.push(newMessage);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            message: {
              id: newMessage.id,
              chat_id: E2E_CHAT_ID,
              sender_user_id: options.viewerUserId,
              message_type: "TEXT",
              payload: newMessage.payload,
              idempotency_key: newMessage.idempotency_key,
              created_at: newMessage.created_at,
            },
            conversation: baseConversation(),
          }),
        });
        return;
      }

      case "cns_mark_conversation_read":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ last_read_at: new Date().toISOString() }),
        });
        return;

      case "accept_proposal":
        capturedRpc.acceptProposal.push(body);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            proposal: { id: E2E_PROPOSAL_ID, status: "ACCEPTED" },
            service: {
              id: withPaymentCheckout ? "service-e2e-paid-1" : "service-e2e-1",
              status: "PENDING_PAYMENT",
            },
          }),
        });
        return;

      case "payment_get_checkout_step_requirements":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            needs_cpf: true,
            needs_phone: false,
            needs_card: true,
          }),
        });
        return;

      case "payment_get_proposal_checkout_context":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            proposal_id: E2E_PROPOSAL_ID,
            service_request_id: E2E_SR_ID,
            provider_id: E2E_PROVIDER_ID,
            proposed_amount: 450,
            pricing_signature: "pricing-sig-e2e",
            payment_required: withPaymentCheckout,
          }),
        });
        return;

      case "payment_calculate_installment_options":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            installment_options: [{
              installment_number: 1,
              installment_amount: 450,
              total_with_fees: 459,
            }],
            installment_selection_hmac: "installment-hmac-e2e",
            installment_hmac_payload: {
              proposal_id: E2E_PROPOSAL_ID,
              service_id: E2E_SR_ID,
              card_brand: "VISA",
              installment_number: 1,
            },
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            computed_at: new Date().toISOString(),
          }),
        });
        return;

      case "create_provider_proposal":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: E2E_PROPOSAL_ID,
            proposal: { id: E2E_PROPOSAL_ID, status: "PENDING", version: 1 },
            timeline_message: null,
          }),
        });
        return;

      case "submit_proposal":
        await route.fulfill({
          status: 410,
          contentType: "application/json",
          body: JSON.stringify({ message: "submit_proposal removed" }),
        });
        return;

      default:
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(null),
        });
    }
  });

  return { capturedRpc, messages };
}
