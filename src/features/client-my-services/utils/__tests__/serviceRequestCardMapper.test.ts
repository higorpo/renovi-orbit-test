import { describe, it, expect } from "vitest";
import { mapToServiceRequestCardModel } from "../serviceRequestCardMapper";
import type { ServiceRequestWithRelationsRow } from "../../api/serviceRequests.api";

function makeRow(
  overrides: Partial<ServiceRequestWithRelationsRow> = {}
): ServiceRequestWithRelationsRow {
  return {
    id: "id-1",
    client_id: "client-1",
    service_id: "svc-1",
    address_id: "addr-1",
    title: "Troca de tomadas",
    description: "Preciso trocar tomadas na sala.",
    status: "open",
    photos: null,
    created_at: "2025-03-01T10:00:00Z",
    updated_at: "2025-03-01T10:00:00Z",
    form_data: null,
    form_schema: null,
    form_version: null,
    urgency: null,
    scope_complexity: null,
    suggested_questions: null,
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
  it("maps row to card model with address and service", () => {
    const row = makeRow();
    const model = mapToServiceRequestCardModel(row);
    expect(model.id).toBe("id-1");
    expect(model.title).toBe("Troca de tomadas");
    expect(model.descriptionPreview).toContain("Preciso trocar");
    expect(model.status).toBe("open");
    expect(model.statusTabId).toBe("waiting_proposals");
    expect(model.address?.streetSummary).toBe("Rua X, 100");
    expect(model.address?.neighborhood).toBe("Trindade");
    expect(model.address?.cityName).toBe("Florianópolis");
    expect(model.address?.stateAbbreviation).toBe("SC");
    expect(model.service?.title).toBe("Eletricista");
    expect(model.service?.slug).toBe("eletricista");
    expect(model.service?.icon_key).toBe("Zap");
    expect(model.service?.color_key).toBe("yellow_orange");
    expect(model.proposalCount).toBe(0);
    expect(model.hasSubmittedProposal).toBe(false);
  });

  it("handles null address and service", () => {
    const row = makeRow({
      address_id: null,
      client_addresses: null,
      platform_services: null,
    });
    const model = mapToServiceRequestCardModel(row);
    expect(model.address).toBeNull();
    expect(model.service).toBeNull();
  });

  it("maps status closed to statusTabId completed", () => {
    const row = makeRow({ status: "closed" });
    const model = mapToServiceRequestCardModel(row);
    expect(model.statusTabId).toBe("completed");
  });

  it("maps submitted proposals metadata", () => {
    const row = makeRow({
      provider_proposals: [{ status: "submitted" }, { status: "draft" }],
    });
    const model = mapToServiceRequestCardModel(row);
    expect(model.proposalCount).toBe(2);
    expect(model.hasSubmittedProposal).toBe(true);
  });

  it("builds streetSummary from street only when number is missing", () => {
    const row = makeRow({
      client_addresses: {
        neighborhood: "N",
        street: "Só rua",
        number: "",
        platform_cities: { name: "C" },
        platform_states: { abbreviation: "ST" },
      },
    });
    const model = mapToServiceRequestCardModel(row);
    expect(model.address?.streetSummary).toBe("Só rua");
  });

  it("normalizes non-object form_data and form_schema to null", () => {
    const row = makeRow({
      form_data: [] as unknown as null,
      form_schema: [] as unknown as null,
      photos: "x" as unknown as null,
    });
    const model = mapToServiceRequestCardModel(row);
    expect(model.formData).toBeNull();
    expect(model.formSchema).toBeNull();
    expect(model.photoPaths).toEqual([]);
  });

  it("defaults status to open when missing", () => {
    const row = makeRow({ status: undefined as unknown as "open" });
    const model = mapToServiceRequestCardModel(row);
    expect(model.status).toBe("open");
  });
});
