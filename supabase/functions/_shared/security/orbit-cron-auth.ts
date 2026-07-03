import { timingSafeEqualStrings } from "./timingSafeEqual.ts";

export const ORBIT_CRON_SECRET_HEADER = "X-Orbit-Cron-Secret";

export type OrbitCronAuthResult =
  | { ok: true }
  | { ok: false; status: number; code: string };

/** Validates pg_net/cron invoke: X-Orbit-Cron-Secret or service_role bearer (dev/ops). */
export function validateOrbitCronAuth(req: Request): OrbitCronAuthResult {
  const cronSecret = Deno.env.get("ORBIT_CRON_SECRET");
  const headerSecret = req.headers.get(ORBIT_CRON_SECRET_HEADER);

  if (cronSecret && headerSecret && timingSafeEqualStrings(headerSecret, cronSecret)) {
    return { ok: true };
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (
    serviceRoleKey &&
    authorization?.startsWith("Bearer ") &&
    timingSafeEqualStrings(authorization.slice(7), serviceRoleKey)
  ) {
    return { ok: true };
  }

  return { ok: false, status: 401, code: "unauthorized" };
}
