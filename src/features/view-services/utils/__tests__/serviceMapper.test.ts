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

  it("defaults unknown list phase to negotiation and handles sparse rows", () => {
    const model = mapRpcServiceRow({
      id: "sr-sparse",
      list_phase: "unknown_phase",
      request: {
        title: null,
        description: null,
        photos: null,
        address: {
          street: "Rua Só",
          number: null,
          neighborhood: null,
          city_name: null,
        },
        platform_service: { title: "Sem slug" },
      },
      negotiation: {
        my_proposal: { id: "p1" },
        chat: { is_unread: true },
      },
      contracted: { id: "cs-1" },
      counterparty: { display_name: "  " },
    });

    expect(model.listPhase).toBe("negotiation");
    expect(model.statusTabId).toBe("negotiation");
    expect(model.title).toBe("");
    expect(model.descriptionPreview).toBe("");
    expect(model.photoPaths).toEqual([]);
    expect(model.address?.streetSummary).toBe("Rua Só");
    expect(model.service).toBeNull();
    expect(model.contracted).toBeNull();
    expect(model.counterparty).toBeNull();
    expect(model.myProposal).toBeNull();
    expect(model.chatSummary).toBeNull();
  });

  it("maps street with number and contracted provider fallbacks", () => {
    const model = mapRpcServiceRow({
      id: "sr-2",
      list_phase: "COMPLETED",
      request: {
        title: "Job",
        form_data: { a: 1 },
        form_schema: { type: "object" },
        address: {
          street: "Av. Paulista",
          number: "1000",
          neighborhood: "Bela Vista",
          city_name: "São Paulo",
          state_abbreviation: "SP",
        },
        platform_service: {
          title: "Pintor",
          slug: "pintor",
          icon_key: "paint",
          color_key: "blue",
        },
        tags: ["urgente"],
        missing_info_warnings: ["foto"],
      },
      negotiation: {
        chat: {
          id: "chat-2",
          last_message_preview: "  oi  ",
          provider_display_name: "  Ana  ",
        },
      },
      contracted: {
        id: "cs-2",
        status: "CONFIRMED",
        agreed_slot: { day: "mon" },
        provider: { id: "prov-1", display_name: "  " },
        payment_schedule_state: null,
      },
      counterparty: null,
    });

    expect(model.listPhase).toBe("completed");
    expect(model.address?.streetSummary).toBe("Av. Paulista, 1000");
    expect(model.service?.icon_key).toBe("paint");
    expect(model.formData).toEqual({ a: 1 });
    expect(model.formSchema).toEqual({ type: "object" });
    expect(model.tags).toEqual(["urgente"]);
    expect(model.missingInfoWarnings).toEqual(["foto"]);
    expect(model.chatSummary?.lastMessagePreview).toBe("oi");
    expect(model.chatSummary?.providerDisplayName).toBe("Ana");
    expect(model.contracted?.provider?.displayName).toBe("—");
    expect(model.counterpartyName).toBe("—");
    expect(model.contracted?.agreedSlot).toEqual({ day: "mon" });
  });
});
