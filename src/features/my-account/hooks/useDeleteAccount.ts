import { useState } from "react";
import { toast } from "sonner";

/**
 * Placeholder for account deletion. When backend supports it, call the API and sign out.
 */
export function useDeleteAccount() {
  const [isDeleting, setIsDeleting] = useState(false);

  const requestDelete = async () => {
    setIsDeleting(true);
    try {
      // TODO: call backend delete-account endpoint then signOut
      await new Promise((r) => setTimeout(r, 500));
      toast.info("Exclusão de conta ainda não disponível. Entre em contato com o suporte.");
    } catch {
      toast.error("Não foi possível processar a solicitação.");
    } finally {
      setIsDeleting(false);
    }
  };

  return { requestDelete, isDeleting };
}
