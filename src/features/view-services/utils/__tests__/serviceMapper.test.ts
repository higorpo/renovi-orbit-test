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
        },
        platform_service: {
          title: "Eletricista",
          slug: "eletricista",
        },
        tags: ["tag-a"],
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
        },
        chat: {
          id: "chat-1",
          is_unread: true,
          last_interaction_at: "2025-01-03T01:00:00Z",
        },
      },
      contracted: {
        id: "cs-1",
        status: "PENDING_PAYMENT",
        provider: { id: "p-1", display_name: "João" },
      },
      counterparty: { id: "p-1", display_name: "João" },
    });

    expect(model.id).toBe("sr-1");
    expect(model.listPhase).toBe("in_progress");
    expect(model.title).toBe("Título");
    expect(model.proposalCount).toBe(2);
    expect(model.hasPendingProposal).toBe(true);
    expect(model.service?.slug).toBe("eletricista");
    expect(model.contracted?.status).toBe("PENDING_PAYMENT");
    expect(model.tags).toEqual(["tag-a"]);
    expect(model.suggestedEquipment).toEqual(["ladder"]);
    expect(model.suggestedMaterials).toEqual(["screws"]);
    expect(model.lastActivityAt).toBe("2025-01-03T00:00:00Z");
    expect(model.myProposal?.status).toBe("PENDING");
    expect(model.chatSummary?.isUnread).toBe(true);
  });
});
