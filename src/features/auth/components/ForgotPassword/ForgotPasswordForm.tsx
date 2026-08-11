import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ForgotPasswordFormData } from "../../types/forgotPassword.validation";

const INPUT_CLASS =
  "bg-white/10 border-white/30 text-white placeholder:text-white/50 h-12 focus:border-[#2563EB] focus:ring-[#2563EB]/20";
const INPUT_ERROR_CLASS = "border-red-400";
const ERROR_MESSAGE_CLASS =
  "text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2";

export interface ForgotPasswordFormProps {
  formData: ForgotPasswordFormData;
  setFormData: React.Dispatch<React.SetStateAction<ForgotPasswordFormData>>;
  errors: Record<string, string>;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ForgotPasswordForm({
  formData,
  setFormData,
  errors,
  submitting,
  onSubmit,
}: ForgotPasswordFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-white/90 font-medium">
          Email *
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={formData.email}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, email: e.target.value }))
          }
          className={cn(INPUT_CLASS, errors.email && INPUT_ERROR_CLASS)}
        />
        {errors.email && (
          <p className={ERROR_MESSAGE_CLASS}>{errors.email}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-12 md:h-14 text-base md:text-lg font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-[#2563EB]/30 hover:shadow-xl hover:shadow-[#2563EB]/40 transition-all duration-300 hover:scale-[1.02]"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Enviando...
          </>
        ) : (
          "Enviar link de redefinição"
        )}
      </Button>
    </form>
  );
}
