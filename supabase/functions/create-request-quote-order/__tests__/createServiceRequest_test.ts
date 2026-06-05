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
