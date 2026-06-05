import { describe, it, expect } from "vitest";
import { mapToServiceRequestCardModel } from "../serviceRequestCardMapper";
import type { ServiceRequestWithRelationsRow } from "../../api/serviceRequests.api";

function makeRow(
  overrides: Partial<ServiceRequestWithRelationsRow> = {},
): ServiceRequestWithRelationsRow {
  return {
    id: "id-1",
    client_id: "client-1",
    service_id: "svc-1",
    address_id: "addr-1",
    title: "Troca de tomadas",
    description: "Preciso trocar tomadas na sala.",
    status: "OPEN",
    contracted_service_id: null,
    photos: null,
    created_at: "2025-03-01T10:00:00Z",
    updated_at: "2025-03-01T10:00:00Z",
    form_data: null,
    form_schema: null,
    form_version: null,
    urgency: null,
    scope_complexity: null,
    tags: null,
    missing_info_warnings: null,
    suggested_equipment: null,
    suggested_materials: null,
    estimated_duration_hint: null,
    client_addresses: {
      neighborhood: "Trindade",
      street: "Rua X",
      number: "100",
      platform_cities: { name: "Florianópolis" },
      platform_states: { abbreviation: "SC" },
    },
    platform_services: {
      title: "Eletricista",
      slug: "eletricista",
      icon_key: "Zap",
      color_key: "yellow_orange",
    },
    ...overrides,
  } as ServiceRequestWithRelationsRow;
}

describe("mapToServiceRequestCardModel", () => {
  it("maps open SR without contracted service to negotiation phase", () => {
    const model = mapToServiceRequestCardModel(makeRow());
    expect(model.listPhase).toBe("negotiation");
    expect(model.statusTabId).toBe("negotiation");
    expect(model.contractedServiceId).toBeNull();
  });

  it("maps COMPLETED SR with active contracted service to in_progress phase", () => {
    const model = mapToServiceRequestCardModel(
      makeRow({
        status: "COMPLETED",
        contracted_service_id: "cs-1",
        services: {
          id: "cs-1",
          status: "PENDING_PAYMENT",
          provider: {
            full_name: "João Silva",
            provider_profiles_public: { display_name: "João Eletricista" },
          },
        },
      }),
    );
    expect(model.listPhase).toBe("in_progress");
    expect(model.selectedProfessionalName).toBe("João Eletricista");
  });

  it("maps COMPLETED SR and COMPLETED contracted service to completed phase", () => {
    const model = mapToServiceRequestCardModel(
      makeRow({
        status: "COMPLETED",
        contracted_service_id: "cs-1",
        services: { id: "cs-1", status: "COMPLETED", provider: null },
      }),
    );
    expect(model.listPhase).toBe("completed");
  });

  it("maps pending proposals metadata", () => {
    const model = mapToServiceRequestCardModel(
      makeRow({
        provider_proposals: [{ status: "PENDING" }, { status: "REJECTED" }],
      }),
    );
    expect(model.proposalCount).toBe(2);
    expect(model.hasPendingClientProposal).toBe(true);
  });

  it("maps insight fields from row", () => {
    const model = mapToServiceRequestCardModel(
      makeRow({
        urgency: "high",
        scope_complexity: "simple",
        estimated_duration_hint: "1_day",
        tags: ["Tomada"],
        missing_info_warnings: ["Falta foto"],
      }),
    );
    expect(model.urgency).toBe("high");
    expect(model.scopeComplexity).toBe("simple");
    expect(model.estimatedDurationHint).toBe("1_day");
    expect(model.tags).toEqual(["Tomada"]);
    expect(model.missingInfoWarnings).toEqual(["Falta foto"]);
  });
});
