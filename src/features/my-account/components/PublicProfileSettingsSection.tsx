import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { Eye, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ProviderAccountFormData } from "../types/providerAccountForm.validation";
import { ServiceAreaField } from "./ServiceAreaField";

export interface PublicProfileSettingsSectionProps {
  form: UseFormReturn<ProviderAccountFormData>;
  profileSlug: string | null;
  disabled?: boolean;
}

function buildProfileUrl(slug: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/perfil/${slug}`;
}

export function PublicProfileSettingsSection({
  form,
  profileSlug,
  disabled,
}: PublicProfileSettingsSectionProps) {
  const [copied, setCopied] = useState(false);

  const profileUrl = profileSlug ? buildProfileUrl(profileSlug) : null;

  const handleCopyLink = useCallback(() => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl).then(
      () => {
        setCopied(true);
        toast.success("Link copiado para a área de transferência.");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Não foi possível copiar o link.")
    );
  }, [profileUrl]);

  const handleViewProfile = useCallback(() => {
    if (profileUrl) window.open(profileUrl, "_blank");
  }, [profileUrl]);

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <SectionTitleWithIcon
          title="Perfil público"
          icon={Eye}
          iconGradient="from-cyan-500 to-blue-600"
          size="compact"
          className="!mb-0"
        />
      </CardHeader>
      <CardContent className="!pt-4 space-y-4">
        <FormField
          control={form.control}
          name="display_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome profissional (exibido no perfil)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Como você quer ser chamado"
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Biografia</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Conte um pouco sobre sua experiência e forma de trabalho..."
                  rows={4}
                  disabled={disabled}
                  className="resize-y"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <ServiceAreaField form={form} disabled={disabled} />
        <FormField
          control={form.control}
          name="profile_visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visibilidade do perfil</FormLabel>
              <FormControl>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
                  <label className="flex flex-1 min-w-0 cursor-pointer">
                    <input
                      type="radio"
                      name="profile_visibility"
                      value="public"
                      checked={field.value === "public"}
                      onChange={() => field.onChange("public")}
                      disabled={disabled}
                      className="sr-only peer"
                    />
                    <span className="flex flex-1 min-h-[4.5rem] items-center rounded-md border px-3 py-2 text-sm peer-checked:border-primary peer-checked:bg-primary/10">
                      Público — qualquer pessoa pode ver e o perfil pode ser indexado por buscadores.
                    </span>
                  </label>
                  <label className="flex flex-1 min-w-0 cursor-pointer">
                    <input
                      type="radio"
                      name="profile_visibility"
                      value="restricted"
                      checked={field.value === "restricted"}
                      onChange={() => field.onChange("restricted")}
                      disabled={disabled}
                      className="sr-only peer"
                    />
                    <span className="flex flex-1 min-h-[4.5rem] items-center rounded-md border px-3 py-2 text-sm peer-checked:border-primary peer-checked:bg-primary/10">
                      Restrito — apenas clientes logados podem ver.
                    </span>
                  </label>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {profileUrl && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleViewProfile}
              disabled={disabled}
            >
              <Eye className="h-4 w-4 mr-2" aria-hidden />
              Visualizar perfil
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={disabled}
            >
              {copied ? (
                <Check className="h-4 w-4 mr-2 text-green-600" aria-hidden />
              ) : (
                <Copy className="h-4 w-4 mr-2" aria-hidden />
              )}
              Copiar link do perfil
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
