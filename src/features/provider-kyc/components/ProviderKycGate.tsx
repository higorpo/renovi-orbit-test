import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router";
import { useAuth } from "@/features/auth";
import {
  isProviderCredentialed,
  isProviderKycAwaitingReview,
  isProviderKycDocumentsSubmitted,
  isProviderKycPending,
  isProviderKycRejected,
  isProviderKycSubmitting,
  isProviderKycSuspended,
} from "../api/kyc.api";
import { PROVIDER_KYC_ALLOWED_PATH_PREFIX } from "../constants/kyc.constants";
import { useProviderPaymentAccount } from "../hooks/useProviderPaymentAccount";
import { useRetryKycEmailDispatch } from "../hooks/useRetryKycEmailDispatch";
import { ProviderKycForm } from "./ProviderKycForm";
import {
  KycDocumentsSubmittedStatus,
  KycGenericBlockedStatus,
  KycRejectedStatus,
  KycSubmittingStatus,
  KycSuspendedStatus,
  KycUnderReviewStatus,
} from "./status";

function isAllowedBlockedPath(pathname: string): boolean {
  return (
    pathname === PROVIDER_KYC_ALLOWED_PATH_PREFIX
    || pathname.startsWith(`${PROVIDER_KYC_ALLOWED_PATH_PREFIX}/`)
  );
}

export function ProviderKycGate({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  const accountQuery = useProviderPaymentAccount(profile?.role === "provider");
  const account = accountQuery.data ?? null;
  const isSubmitting = isProviderKycSubmitting(account);
  const [showRejectedForm, setShowRejectedForm] = useState(false);

  useRetryKycEmailDispatch(isSubmitting && !accountQuery.isLoading);

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

  if (isAllowedBlockedPath(pathname)) {
    return children;
  }

  if (isProviderCredentialed(account)) {
    return children;
  }

  if (isSubmitting) {
    return <KycSubmittingStatus />;
  }

  if (isProviderKycPending(account)) {
    return (
      <div className="container max-w-2xl px-4 py-6">
        <ProviderKycForm
          providerId={user!.id}
          accountEmail={user?.email ?? ""}
          defaultPhone={profile?.phone ?? undefined}
          defaultFullName={profile?.full_name ?? undefined}
          onSubmitted={() => void accountQuery.refetch()}
        />
      </div>
    );
  }

  if (isProviderKycDocumentsSubmitted(account)) {
    return <KycDocumentsSubmittedStatus />;
  }

  if (isProviderKycAwaitingReview(account)) {
    return <KycUnderReviewStatus />;
  }

  if (isProviderKycRejected(account)) {
    if (showRejectedForm) {
      return (
        <div className="container max-w-2xl px-4 py-6">
          <ProviderKycForm
            providerId={user!.id}
            accountEmail={user?.email ?? ""}
            defaultPhone={profile?.phone ?? undefined}
            defaultFullName={profile?.full_name ?? undefined}
            onSubmitted={() => {
              setShowRejectedForm(false);
              void accountQuery.refetch();
            }}
          />
        </div>
      );
    }

    return <KycRejectedStatus onResubmit={() => setShowRejectedForm(true)} />;
  }

  if (isProviderKycSuspended(account)) {
    return <KycSuspendedStatus />;
  }

  return <KycGenericBlockedStatus />;
}
