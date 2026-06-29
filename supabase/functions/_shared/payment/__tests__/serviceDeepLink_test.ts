import { assertEquals } from "std/testing/asserts";
import {
  buildServiceDetailDeepLinkPath,
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
