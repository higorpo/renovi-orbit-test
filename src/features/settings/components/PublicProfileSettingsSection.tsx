import { useCallback, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { LucideIcon } from "lucide-react";
import { Check, Copy, Eye, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsCardHeader } from "./SettingsCardHeader";
import type { ProviderAccountFormData } from "../types/providerAccountForm.validation";

export interface PublicProfileSettingsSectionProps {
  form: UseFormReturn<ProviderAccountFormData>;
  profileSlug: string | null;
  disabled?: boolean;
}

function buildProfileUrl(slug: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/perfil/${slug}`;
}

interface VisibilityOptionProps {
  selected: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onSelect: () => void;
}

function VisibilityOption({
  selected,
  disabled,
  icon: Icon,
  title,
  description,
  onSelect,
}: VisibilityOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={cn(
        "relative flex min-h-11 flex-col items-start gap-3 rounded-2xl border p-4 text-left",
        "transition-[border-color,background-color,transform,box-shadow] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-ink bg-canvas shadow-sm"
          : "border-border bg-canvas hover:border-ink/20 hover:bg-canvas-soft",
      )}
    >
      <span
        className={cn(
          "absolute right-3.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full",
          "transition-colors duration-150",
          selected ? "bg-ink text-white" : "border border-border bg-canvas",
        )}
        aria-hidden
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={2.75} /> : null}
      </span>
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150",
          selected ? "bg-ink text-white" : "bg-primary-soft text-ink",
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="space-y-1 pr-6">
        <span className="block font-display text-[15px] font-semibold tracking-tight text-ink">
          {title}
        </span>
        <span className="block text-sm leading-relaxed text-body">{description}</span>
      </span>
    </button>
  );
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
      () => toast.error("Não foi possível copiar o link."),
    );
  }, [profileUrl]);

  const handleViewProfile = useCallback(() => {
    if (profileUrl) window.open(profileUrl, "_blank");
  }, [profileUrl]);

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3 sm:pb-3">
        <SettingsCardHeader
          title="Perfil público"
          icon={Eye}
          description="Nome, bio e visibilidade do perfil"
        />
      </CardHeader>
      <CardContent className="space-y-5 pt-0 sm:pt-0">
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
                  className="resize-y max-sm:resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="profile_visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visibilidade do perfil</FormLabel>
              <FormControl>
                <div
                  role="radiogroup"
                  aria-label="Visibilidade do perfil"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <VisibilityOption
                    selected={field.value === "public"}
                    disabled={disabled}
                    icon={Globe}
                    title="Público"
                    description="Qualquer pessoa pode ver e o perfil pode ser indexado por buscadores."
                    onSelect={() => field.onChange("public")}
                  />
                  <VisibilityOption
                    selected={field.value === "restricted"}
                    disabled={disabled}
                    icon={Lock}
                    title="Restrito"
                    description="Apenas clientes logados podem ver."
                    onSelect={() => field.onChange("restricted")}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {profileUrl ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-canvas-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold tracking-tight text-ink">
                Ver como os clientes veem
              </p>
              <p className="mt-0.5 truncate text-sm text-body">/perfil/{profileSlug}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 rounded-full sm:min-h-9"
                onClick={handleViewProfile}
                disabled={disabled}
              >
                <Eye className="h-4 w-4" aria-hidden />
                Visualizar perfil
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 rounded-full sm:min-h-9"
                onClick={handleCopyLink}
                disabled={disabled}
                aria-label="Copiar link do perfil"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                Copiar link
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
