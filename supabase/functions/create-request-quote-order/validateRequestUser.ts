import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getUserIdFromRequest } from "../_shared/rateLimiter.ts";

export type ValidateUserResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

export async function validateRequestUser(
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, status: 500, message: "Erro interno." };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
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
