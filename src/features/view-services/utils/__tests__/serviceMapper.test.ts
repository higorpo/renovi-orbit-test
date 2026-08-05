// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mapRpcServiceRow } from "../serviceMapper";

describe("serviceMapper", () => {
  it("maps RPC row into ServiceModel", () => {
    const model = mapRpcServiceRow({
      id: "sr-1",
      list_phase: "in_progress",
      enrichment_status: "READY",
      enrichment_ready: true,
      executed_late: false,
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
    expect(model.enrichmentStatus).toBe("READY");
    expect(model.enrichmentReady).toBe(true);
    expect(model.executedLate).toBe(false);
    expect(model.title).toBe("Título");
    expect(model.proposalCount).toBe(2);
    expect(model.hasPendingProposal).toBe(true);
    expect(model.service?.slug).toBe("eletricista");
    expect(model.contracted?.status).toBe("PENDING_PAYMENT");
    expect(model.contracted?.chatId).toBe("chat-contracted-1");
    expect(model.contracted?.paymentScheduleState).toBe("FAILED_PERMANENT");
    expect(model.contracted?.farRecapturePending).toBe(false);
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

describe("serviceMapper branch coverage", () => {
  it("maps null addresses and number-only or empty street summaries", () => {
    const noAddress = mapRpcServiceRow({ id: "none", request: { address: null } });
    const numberOnly = mapRpcServiceRow({
      id: "number",
      request: { address: { street: " ", number: "42" } },
    });
    const empty = mapRpcServiceRow({
      id: "empty",
      request: { address: { street: " ", number: "" } },
    });

    expect(noAddress.address).toBeNull();
    expect(numberOnly.address?.streetSummary).toBe("42");
    expect(empty.address?.streetSummary).toBeUndefined();
  });

  it("rejects incomplete nested entities and normalizes explicit list phases", () => {
    const negotiation = mapRpcServiceRow({
      id: "negotiation",
      list_phase: "NEGOTIATION",
      request: { platform_service: { title: "Only title" } },
      negotiation: { my_proposal: { id: "p1" } },
      contracted: { id: "c1" },
    });
    const cancelled = mapRpcServiceRow({ id: "cancelled", list_phase: " cancelled " });

    expect(negotiation.listPhase).toBe("negotiation");
    expect(negotiation.service).toBeNull();
    expect(negotiation.myProposal).toBeNull();
    expect(negotiation.contracted).toBeNull();
    expect(cancelled.listPhase).toBe("cancelled");
  });

  it("normalizes optional records, arrays, unread state, and blank proposal copy", () => {
    const model = mapRpcServiceRow({
      id: "sparse",
      request: {
        form_data: [],
        photos: "not-an-array",
        tags: "tag",
        missing_info_warnings: {},
        suggested_equipment: "ladder",
        suggested_materials: 123,
      },
      negotiation: {
        my_proposal: {
          id: "p1",
          status: "PENDING",
          revision_notes: "   ",
          client_rejection_response: "\n",
        },
        chat: { id: "chat-1" },
      },
    } as unknown as Parameters<typeof mapRpcServiceRow>[0]);

    expect(model.formData).toBeNull();
    expect(model.photoPaths).toEqual([]);
    expect(model.tags).toBeNull();
    expect(model.missingInfoWarnings).toBeNull();
    expect(model.suggestedEquipment).toBeNull();
    expect(model.suggestedMaterials).toBeNull();
    expect(model.myProposal?.revisionNotes).toBeNull();
    expect(model.myProposal?.clientRejectionResponse).toBeNull();
    expect(model.chatSummary?.isUnread).toBe(false);
  });

  it("uses the contracted id and provider name fallbacks and rejects non-record slots", () => {
    const model = mapRpcServiceRow({
      id: "contracted",
      request: { contracted_service_id: null },
      contracted: {
        id: "contracted-1",
        status: "CONFIRMED",
        agreed_slot: "invalid",
        provider: { id: "provider-1", display_name: "Maria" },
      },
      counterparty: null,
    });

    expect(model.contractedServiceId).toBe("contracted-1");
    expect(model.contracted?.agreedSlot).toBeNull();
    expect(model.counterpartyName).toBe("Maria");
  });

  it("returns null platform service when title is missing but slug exists", () => {
    const model = mapRpcServiceRow({
      id: "no-title",
      request: { platform_service: { slug: "eletricista" } },
    });
    expect(model.service).toBeNull();
  });

  it("returns null platform service when platform_service is null", () => {
    const model = mapRpcServiceRow({
      id: "null-ps",
      request: { platform_service: null },
    });
    expect(model.service).toBeNull();
  });

  it("preserves null icon_key and color_key on platform service", () => {
    const model = mapRpcServiceRow({
      id: "null-keys",
      request: {
        platform_service: {
          title: "Pintor",
          slug: "pintor",
          icon_key: null,
          color_key: null,
        },
      },
    });
    expect(model.service).toEqual({
      title: "Pintor",
      slug: "pintor",
      icon_key: null,
      color_key: null,
    });
  });

  it("maps counterparty whitespace display name and blank profile path", () => {
    const model = mapRpcServiceRow({
      id: "cp",
      counterparty: {
        id: "cp-1",
        display_name: "   ",
        profile_image_path: "  ",
      },
    });
    expect(model.counterparty).toEqual({
      id: "cp-1",
      displayName: "—",
      profileImagePath: null,
    });
  });

  it("returns null contracted when status exists but id is missing", () => {
    const model = mapRpcServiceRow({
      id: "no-cs-id",
      contracted: { status: "CONFIRMED" },
    });
    expect(model.contracted).toBeNull();
  });

  it("maps contracted service with null provider and null agreed_slot", () => {
    const model = mapRpcServiceRow({
      id: "cs-null-provider",
      contracted: {
        id: "cs-1",
        status: "CONFIRMED",
        agreed_slot: null,
        provider: null,
      },
    });
    expect(model.contracted?.provider).toBeNull();
    expect(model.contracted?.agreedSlot).toBeNull();
  });

  it("maps contracted reschedule snapshot when present", () => {
    const model = mapRpcServiceRow({
      id: "cs-reschedule",
      contracted: {
        id: "cs-1",
        status: "CONFIRMED",
        reschedule: {
          contracted_service_id: "cs-1",
          duration_unit: "hours",
          duration_value: 2,
          active_request: null,
          display_status: "REQUESTED",
        },
      },
    });
    expect(model.contracted?.reschedule?.contractedServiceId).toBe("cs-1");
    expect(model.contracted?.reschedule?.displayStatus).toBe("REQUESTED");
  });

  it("normalizes in_progress list phase and defaults missing list_phase", () => {
    expect(mapRpcServiceRow({ id: "ip", list_phase: "IN_PROGRESS" }).listPhase).toBe(
      "in_progress",
    );
    expect(mapRpcServiceRow({ id: "missing" }).listPhase).toBe("negotiation");
  });

  it("returns null myProposal when status exists but id is missing", () => {
    const model = mapRpcServiceRow({
      id: "no-prop-id",
      negotiation: { my_proposal: { status: "PENDING" } },
    });
    expect(model.myProposal).toBeNull();
  });

  it("maps myProposal clientRejectionResponse and defaults omitted numeric fields", () => {
    const model = mapRpcServiceRow({
      id: "prop-defaults",
      negotiation: {
        my_proposal: {
          id: "p1",
          status: "PENDING",
          client_rejection_response: "  Preço alto  ",
        },
      },
    });
    expect(model.myProposal).toMatchObject({
      id: "p1",
      finalAmount: 0,
      updatedAt: "",
      expiredAt: null,
      submittedAt: null,
      clientRejectionResponse: "Preço alto",
    });
  });

  it("returns null formSchema for non-record form_schema and null formData", () => {
    const model = mapRpcServiceRow({
      id: "schema",
      request: {
        form_data: null,
        form_schema: ["not", "a", "record"],
      },
    } as unknown as Parameters<typeof mapRpcServiceRow>[0]);
    expect(model.formData).toBeNull();
    expect(model.formSchema).toBeNull();
  });

  it("prefers request contracted_service_id and counterparty displayName", () => {
    const model = mapRpcServiceRow({
      id: "pref",
      request: { contracted_service_id: "from-request" },
      contracted: {
        id: "from-contracted",
        status: "CONFIRMED",
        provider: { id: "p1", display_name: "Provider Name" },
      },
      counterparty: { id: "c1", display_name: "Counterparty Name" },
    });
    expect(model.contractedServiceId).toBe("from-request");
    expect(model.counterpartyName).toBe("Counterparty Name");
  });

  it("maps request metadata and defaults negotiation counters when omitted", () => {
    const model = mapRpcServiceRow({
      id: "meta",
      request: {
        urgency: "high",
        scope_complexity: "medium",
        estimated_duration_hint: "2h",
        address: {
          neighborhood: null,
          city_name: null,
          latitude: null,
          longitude: null,
        },
      },
    });
    expect(model.urgency).toBe("high");
    expect(model.scopeComplexity).toBe("medium");
    expect(model.estimatedDurationHint).toBe("2h");
    expect(model.proposalCount).toBe(0);
    expect(model.activeChatCount).toBe(0);
    expect(model.unreadChatCount).toBe(0);
    expect(model.address?.neighborhood).toBe("");
    expect(model.address?.cityName).toBe("");
    expect(model.address?.latitude).toBeNull();
    expect(model.address?.longitude).toBeNull();
  });
});
