import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SkeletonField() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function SkeletonTextareaField() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function SkeletonCardSection({ fields = 2, hasTextarea = false }: { fields?: number; hasTextarea?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md shrink-0" />
          <Skeleton className="h-5 w-36" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 !pt-4">
        {Array.from({ length: fields }).map((_, i) =>
          hasTextarea && i === fields - 1 ? (
            <SkeletonTextareaField key={i} />
          ) : (
            <SkeletonField key={i} />
          )
        )}
      </CardContent>
    </Card>
  );
}

/** Skeleton for the client account form (DadosPessoais + ContatoIdentidade). */
export function ClientFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* DadosPessoaisSection: nome + email */}
      <SkeletonCardSection fields={2} />
      {/* ContatoIdentidadeSection: phone + CPF */}
      <SkeletonCardSection fields={2} />
      {/* Auto-save status */}
      <Skeleton className="h-4 w-52" />
    </div>
  );
}

/** Skeleton for the Identidade legal page (entity tiles + document fields). */
export function LegalIdentityFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-2xl border border-border bg-canvas p-4 sm:p-5">
        <div className="space-y-4">
          <Skeleton className="h-4 w-28" />
          <SkeletonField />
          <SkeletonField />
        </div>
      </div>
      <Skeleton className="h-4 w-52" />
    </div>
  );
}

/** Skeleton for EntityTypeSection (two large option buttons). */
function EntityTypeSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md shrink-0" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent className="!pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Skeleton for OfferedServicesSection (search + chips). */
function OfferedServicesSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <Skeleton className="h-5 w-40" />
        </div>
      </CardHeader>
      <CardContent className="!pt-4 space-y-3">
        <Skeleton className="h-11 w-full rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Skeleton for PublicProfileSettingsSection (name + bio + visibility tiles). */
function PublicProfileSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <Skeleton className="h-5 w-28" />
        </div>
      </CardHeader>
      <CardContent className="!pt-4 space-y-4">
        <SkeletonField />
        <SkeletonTextareaField />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceAreaSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <Skeleton className="h-5 w-32" />
        </div>
      </CardHeader>
      <CardContent className="!pt-4 space-y-3">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </CardContent>
    </Card>
  );
}

/** Skeleton for the provider account form sections. */
export function ProviderFormSkeleton() {
  return (
    <div className="space-y-6">
      {/* DadosPessoaisSection: nome + email */}
      <SkeletonCardSection fields={2} />
      {/* Contato: phone */}
      <SkeletonCardSection fields={1} />
      {/* EntityTypeSection */}
      <EntityTypeSkeleton />
      {/* LegalIdentitySection: 1 field (CPF for PF default) */}
      <SkeletonCardSection fields={1} />
      {/* OfferedServicesSection */}
      <OfferedServicesSkeleton />
      {/* PublicProfileSettingsSection */}
      <PublicProfileSkeleton />
      {/* Auto-save status */}
      <Skeleton className="h-4 w-52" />
    </div>
  );
}

/** Skeleton for Perfil profissional (tabs + Pedidos cards). */
export function ProfessionalProfileFormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-full rounded-xl" />
      <OfferedServicesSkeleton />
      <ServiceAreaSkeleton />
      <Skeleton className="h-4 w-52" />
    </div>
  );
}

/** Skeleton for Documentos (read-only onboarding files). */
export function KycDocumentsFormSkeleton() {
  return <SkeletonCardSection fields={3} />;
}

/** Skeleton for Dados bancários (read-only payout account). */
export function PayoutMethodsFormSkeleton() {
  return <SkeletonCardSection fields={4} />;
}
