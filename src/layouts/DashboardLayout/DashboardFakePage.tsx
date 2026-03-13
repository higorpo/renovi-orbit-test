import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/features/auth";

interface DashboardFakePageProps {
  /** Page title when same for all roles. */
  title?: string;
  /** Page title per role when it differs (e.g. requests: "Meus pedidos" vs "Solicitações"). */
  titleByRole?: { client: string; provider: string };
}

/**
 * Placeholder dashboard page that only displays the page name.
 * Use title for shared titles, or titleByRole when the label differs by role.
 */
export function DashboardFakePage({ title, titleByRole }: DashboardFakePageProps) {
  const { profile } = useAuth();
  const role = profile?.role ?? "client";
  const displayTitle =
    title ??
    (titleByRole && (role === "client" || role === "provider") ? titleByRole[role] : undefined) ??
    "Dashboard";

  return (
    <div className="container max-w-4xl px-4 py-6">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">{displayTitle}</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Página em construção.</p>
        </CardContent>
      </Card>
    </div>
  );
}
