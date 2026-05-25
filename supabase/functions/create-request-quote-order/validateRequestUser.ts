import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserIdFromRequest } from "../_shared/rateLimiter.ts";

export type ValidateUserResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function validateRequestUser(
  supabase: SupabaseClient,
  req: Request,
  userId: string,
  email: string
): Promise<ValidateUserResult> {
  const authUserId = await getUserIdFromRequest(req);

  if (authUserId !== null) {
    if (authUserId !== userId) {
      return {
        ok: false,
        status: 403,
        message: "Não é possível criar pedido em nome de outro usuário.",
      };
    }
    return { ok: true };
  }
  const { data: user, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !user?.user) {
    return { ok: false, status: 400, message: "Usuário ou e-mail inválido." };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const userEmail = (user.user.email ?? "").toLowerCase().trim();
  if (userEmail !== normalizedEmail) {
    return { ok: false, status: 400, message: "Usuário ou e-mail inválido." };
  }

  return { ok: true };
}
