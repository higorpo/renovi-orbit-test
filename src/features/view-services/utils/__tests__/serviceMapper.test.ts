// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mapRpcServiceRow } from "../serviceMapper";

describe("serviceMapper", () => {
  it("maps RPC row into ServiceModel", () => {
    const model = mapRpcServiceRow({
      id: "sr-1",
      list_phase: "in_progress",
      request: {
        title: "Título",
        description: "Desc",
        photos: ["a.jpg"],
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
        contracted_service_id: "cs-1",
        address: {
          neighborhood: "Centro",
          city_name: "SP",
          state_abbreviation: "SP",
          latitude: -23.55,
          longitude: -46.63,
        },
        platform_service: {
          title: "Eletricista",
          slug: "eletricista",
        },
        suggested_equipment: ["ladder"],
        suggested_materials: ["screws"],
      },
      negotiation: {
        proposal_count: 2,
        has_pending_proposal: true,
        last_activity_at: "2025-01-03T00:00:00Z",
        my_proposal: {
          id: "prop-1",
          status: "PENDING",
          final_amount: 150,
          updated_at: "2025-01-03T00:00:00Z",
          expired_at: null,
          submitted_at: "2025-01-02T00:00:00Z",
          revision_reason: "PRICE_TOO_HIGH",
          revision_notes: "Muito caro",
          client_rejection_response: null,
        },
        chat: {
          id: "chat-1",
          is_unread: true,
          last_interaction_at: "2025-01-03T01:00:00Z",
          last_message_preview: "Olá!",
        },
      },
      contracted: {
        id: "cs-1",
        status: "PENDING_PAYMENT",
        chat_id: "chat-contracted-1",
        payment_schedule_state: "FAILED_PERMANENT",
        provider: { id: "p-1", display_name: "João" },
      },
      counterparty: { id: "p-1", display_name: "João Silva", profile_image_path: "avatars/joao.jpg" },
    });

    expect(model.id).toBe("sr-1");
    expect(model.listPhase).toBe("in_progress");
    expect(model.title).toBe("Título");
    expect(model.proposalCount).toBe(2);
    expect(model.hasPendingProposal).toBe(true);
    expect(model.service?.slug).toBe("eletricista");
    expect(model.contracted?.status).toBe("PENDING_PAYMENT");
    expect(model.contracted?.chatId).toBe("chat-contracted-1");
    expect(model.contracted?.paymentScheduleState).toBe("FAILED_PERMANENT");
    expect(model.tags).toBeNull();
    expect(model.suggestedEquipment).toEqual(["ladder"]);
    expect(model.suggestedMaterials).toEqual(["screws"]);
    expect(model.lastActivityAt).toBe("2025-01-03T00:00:00Z");
    expect(model.myProposal?.status).toBe("PENDING");
    expect(model.myProposal?.revisionReason).toBe("PRICE_TOO_HIGH");
    expect(model.myProposal?.revisionNotes).toBe("Muito caro");
    expect(model.chatSummary?.isUnread).toBe(true);
    expect(model.chatSummary?.lastMessagePreview).toBe("Olá!");
    expect(model.counterparty?.profileImagePath).toBe("avatars/joao.jpg");
    expect(model.address?.latitude).toBe(-23.55);
    expect(model.address?.longitude).toBe(-46.63);
  });
});
