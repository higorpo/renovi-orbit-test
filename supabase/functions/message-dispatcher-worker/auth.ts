const DISPATCHER_SECRET_HEADER = "X-Dispatcher-Secret";

export interface WorkerAuthFailure {
  ok: false;
  status: number;
  code: string;
}

export type WorkerAuthResult = { ok: true } | WorkerAuthFailure;

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

/** Validates cron secret header or service_role bearer (design §11.6, task 54). */
export function validateWorkerAuth(req: Request): WorkerAuthResult {
  const cronSecret = Deno.env.get("DISPATCHER_CRON_SECRET");
  const headerSecret = req.headers.get(DISPATCHER_SECRET_HEADER);

  if (cronSecret && headerSecret && timingSafeEqual(headerSecret, cronSecret)) {
    return { ok: true };
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (
    serviceRoleKey &&
    authorization?.startsWith("Bearer ") &&
    timingSafeEqual(authorization.slice(7), serviceRoleKey)
  ) {
    return { ok: true };
  }

  return { ok: false, status: 401, code: "unauthorized" };
}
