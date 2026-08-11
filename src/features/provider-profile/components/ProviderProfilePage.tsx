import { Link, useParams, useNavigate } from "react-router";
import { ProviderProfileHeader } from "./ProviderProfileHeader";
import { ProviderProfileAbout } from "./ProviderProfileAbout";
import { ProviderProfileServices } from "./ProviderProfileServices";
import { ProviderProfilePortfolio } from "./ProviderProfilePortfolio";
import { ProviderProfileServiceArea } from "./ProviderProfileServiceArea";
import { ProviderProfileReviews } from "./ProviderProfileReviews";
import { ProviderProfileCtaBanner } from "./ProviderProfileCtaBanner";
import { ProviderProfileSkeleton } from "./ProviderProfileSkeleton";
import { useProviderPublicProfile } from "../hooks/useProviderPublicProfile";
import { useProfileSeo } from "../hooks/useProfileSeo";
import { Button } from "@/components/ui/button";

export function ProviderProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProviderPublicProfile(slug);
  const profile = data?.data ?? null;

  useProfileSeo(profile, isLoading, isError);

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 px-4">
        <ProviderProfileSkeleton />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="container max-w-4xl py-12 px-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Perfil não encontrado
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Este perfil não existe ou está indisponível.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate("/")}
        >
          Voltar ao início
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 px-4">
      <div className="mb-8 flex justify-center">
        <Link to="/">
          <img
            src="/logo-renovi.webp"
            alt="Prestway"
            className="h-7 md:h-8 w-auto"
          />
        </Link>
      </div>

      <div className="space-y-10">
        <ProviderProfileHeader profile={profile} />
        <ProviderProfileAbout profile={profile} />
        <ProviderProfileServices profile={profile} />
        <ProviderProfilePortfolio profile={profile} />
        <ProviderProfileReviews providerId={profile.provider_id} />
        <ProviderProfileServiceArea profile={profile} />
        <ProviderProfileCtaBanner />
      </div>
    </div>
  );
}
