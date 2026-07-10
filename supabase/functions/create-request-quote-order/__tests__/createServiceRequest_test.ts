import { assertEquals } from "std/testing/asserts";
import { createServiceRequest } from "../createServiceRequest.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../_shared/database.types.ts";

function makeSupabaseStub(
  onInsert: (row: Record<string, unknown>) => { data: { id: string } | null; error: { message: string } | null }
): SupabaseClient<Database> {
  return {
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => onInsert(row),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

const baseParams = {
  client_id: "client-1",
  service_id: "service-1",
  address_id: "addr-1",
  service_title: "Pintura",
  request_title: "Pedido de Pintura",
  description: "Descrição",
  photoUrls: [] as string[],
  form_data: {},
  form_schema: null,
  form_version: null,
};

Deno.test("createServiceRequest inserts OPEN status for CNS enum", async () => {
  let insertedStatus: string | undefined;
  const supabase = makeSupabaseStub((row) => {
    insertedStatus = row.status as string;
    return { data: { id: "req-1" }, error: null };
  });

  const result = await createServiceRequest(supabase, baseParams);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.requestId, "req-1");
  }
  assertEquals(insertedStatus, "OPEN");
});

Deno.test("createServiceRequest returns error message on insert failure", async () => {
  const supabase = makeSupabaseStub(() => ({
    data: null,
    error: { message: 'invalid input value for enum service_request_status: "open"' },
  }));

  const result = await createServiceRequest(supabase, baseParams);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, 'invalid input value for enum service_request_status: "open"');
  }
});

Deno.test("createServiceRequest maps optional fields when provided", async () => {
  let inserted: Record<string, unknown> | undefined;
  const supabase = makeSupabaseStub((row) => {
    inserted = row;
    return { data: { id: "req-2" }, error: null };
  });

  const result = await createServiceRequest(supabase, {
    ...baseParams,
    description: "",
    photoUrls: ["https://cdn/a.jpg"],
    form_data: { rooms: 2 },
    form_schema: { type: "object" },
    form_version: "v1",
    urgency: "high",
    scope_complexity: "complex",
    tags: ["pintura"],
    missing_info_warnings: ["need photos"],
    suggested_equipment: ["escada"],
    suggested_materials: ["tinta"],
    estimated_duration_hint: "2h",
  });

  assertEquals(result.ok, true);
  assertEquals(inserted?.description, null);
  assertEquals(inserted?.photos, ["https://cdn/a.jpg"]);
  assertEquals(inserted?.form_data, { rooms: 2 });
  assertEquals(inserted?.urgency, "high");
  assertEquals(inserted?.tags, ["pintura"]);
  assertEquals(inserted?.suggested_equipment, ["escada"]);
  assertEquals(inserted?.estimated_duration_hint, "2h");
});

Deno.test("createServiceRequest nulls empty optional arrays", async () => {
  let inserted: Record<string, unknown> | undefined;
  const supabase = makeSupabaseStub((row) => {
    inserted = row;
    return { data: { id: "req-3" }, error: null };
  });

  await createServiceRequest(supabase, {
    ...baseParams,
    tags: [],
    missing_info_warnings: [],
    suggested_equipment: [],
    suggested_materials: [],
  });

  assertEquals(inserted?.tags, null);
  assertEquals(inserted?.missing_info_warnings, null);
  assertEquals(inserted?.suggested_equipment, null);
  assertEquals(inserted?.suggested_materials, null);
});
