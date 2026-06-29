import { timingSafeEqualStrings } from "./timingSafeEqual.ts";

const CRON_SECRET_HEADER = "X-Payments-Cron-Secret";

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: number; code: string };

function allowServiceRoleFallback(): boolean {
  const env = (
    Deno.env.get("ENVIRONMENT") ??
    Deno.env.get("ENV") ??
    "production"
  ).toLowerCase();
  return env !== "production" && env !== "prod";
}

export function validateCronAuth(req: Request): CronAuthResult {
  const cronSecret = Deno.env.get("PAYMENTS_CRON_SECRET");
  const headerSecret = req.headers.get(CRON_SECRET_HEADER);

  if (cronSecret && headerSecret && timingSafeEqualStrings(headerSecret, cronSecret)) {
    return { ok: true };
  }

  if (allowServiceRoleFallback()) {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (
      serviceRoleKey &&
      authorization?.startsWith("Bearer ") &&
      timingSafeEqualStrings(authorization.slice(7), serviceRoleKey)
    ) {
      return { ok: true };
    }
  }

  return { ok: false, status: 401, code: "unauthorized" };
}
