import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth";
import {
  isProviderKycPending,
  isProviderKycSubmitting,
  shouldBlockProviderForKyc,
} from "../api/kyc.api";
import { ProviderKycForm } from "./ProviderKycForm";
import { useProviderPaymentAccount } from "../hooks/useProviderPaymentAccount";

export function ProviderKycGate({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const accountQuery = useProviderPaymentAccount(profile?.role === "provider");

  if (profile?.role !== "provider") {
    return children;
  }

  if (accountQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Verificando credenciamento…
      </div>
    );
  }

  const account = accountQuery.data ?? null;

  if (!shouldBlockProviderForKyc(account)) {
    return children;
  }

  if (isProviderKycSubmitting(account)) {
    return (
      <div className="container max-w-lg px-4 py-10 space-y-4 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden />
        <h1 className="text-xl font-semibold">Enviando credenciamento…</h1>
        <p className="text-sm text-muted-foreground">
          Estamos finalizando o envio dos seus documentos. Isso pode levar alguns instantes.
        </p>
      </div>
    );
  }

  if (isProviderKycPending(account) || !account) {
    return (
      <div className="container max-w-2xl px-4 py-6">
        <ProviderKycForm
          providerId={user!.id}
          accountEmail={user?.email ?? ""}
          defaultPhone={profile?.phone ?? undefined}
          onSubmitted={() => void accountQuery.refetch()}
        />
      </div>
    );
  }

  return children;
}
