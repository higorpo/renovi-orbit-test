import { assertEquals } from "std/testing/asserts";
import {
  buildServiceDetailDeepLinkPath,
  enrichSchedulesWithServiceRequestIds,
  resolveServiceDeepLinkPath,
  SERVICE_LIST_DEEP_LINK_PATH,
} from "../serviceDeepLink.ts";

Deno.test("buildServiceDetailDeepLinkPath uses dashboard services route", () => {
  assertEquals(
    buildServiceDetailDeepLinkPath("sr-123"),
    "/dashboard/services/sr-123",
  );
});

Deno.test("SERVICE_LIST_DEEP_LINK_PATH points to services list", () => {
  assertEquals(SERVICE_LIST_DEEP_LINK_PATH, "/dashboard/services");
});

Deno.test("resolveServiceDeepLinkPath falls back to services list", () => {
  assertEquals(resolveServiceDeepLinkPath(null), SERVICE_LIST_DEEP_LINK_PATH);
  assertEquals(resolveServiceDeepLinkPath(undefined), SERVICE_LIST_DEEP_LINK_PATH);
});

Deno.test("resolveServiceDeepLinkPath builds service detail route", () => {
  assertEquals(
    resolveServiceDeepLinkPath("sr-123"),
    "/dashboard/services/sr-123",
  );
});

Deno.test("enrichSchedulesWithServiceRequestIds returns empty for empty input", async () => {
  const supabase = {
    from: () => {
      throw new Error("should not query");
    },
  };
  assertEquals(await enrichSchedulesWithServiceRequestIds(supabase as never, []), []);
});

Deno.test("enrichSchedulesWithServiceRequestIds maps service_request_id from DB", async () => {
  const supabase = {
    from: () => ({
      select: () => ({
        in: async () => ({
          data: [
            { id: "cs-1", service_request_id: "sr-1" },
            { id: "cs-2", service_request_id: null },
          ],
          error: null,
        }),
      }),
    }),
  };

  const result = await enrichSchedulesWithServiceRequestIds(supabase as never, [
    { contracted_service_id: "cs-1" },
    { contracted_service_id: "cs-2" },
    { contracted_service_id: "cs-missing" },
  ]);

  assertEquals(result, [
    { contracted_service_id: "cs-1", service_request_id: "sr-1" },
    { contracted_service_id: "cs-2", service_request_id: null },
    { contracted_service_id: "cs-missing", service_request_id: null },
  ]);
});

Deno.test("enrichSchedulesWithServiceRequestIds nulls ids when query fails", async () => {
  const supabase = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: null, error: { message: "db down" } }),
      }),
    }),
  };

  const result = await enrichSchedulesWithServiceRequestIds(supabase as never, [
    { contracted_service_id: "cs-1" },
  ]);

  assertEquals(result, [
    { contracted_service_id: "cs-1", service_request_id: null },
  ]);
});
