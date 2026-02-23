import { Link } from "react-router";
import { useClientSignupForm } from "./useClientSignupForm";
import { ClientSignupForm } from "./ClientSignupForm";
import { Button } from "@/components/ui/button";

export default function ClientSignup() {
  const form = useClientSignupForm();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/hero-client.jpg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F2F3A]/95 via-[#0F2F3A]/90 to-black/80" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-lg">
          <div className="flex justify-center mb-6">
            <Link to="/">
              <img
                src="/logo-renovi-white.webp"
                alt="Renovi"
                className="h-10"
              />
            </Link>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Cadastro de Cliente
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              Encontre os melhores profissionais para sua casa
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8">
            <ClientSignupForm
              currentStep={form.currentStep}
              formData={form.formData}
              setFormData={form.setFormData}
              errors={form.errors}
              submitting={form.submitting}
              showPassword={form.showPassword}
              setShowPassword={form.setShowPassword}
              showConfirmPassword={form.showConfirmPassword}
              setShowConfirmPassword={form.setShowConfirmPassword}
              passwordStrength={form.passwordStrength}
              onNext={form.handleNext}
              onBack={form.handleBack}
              onSubmit={form.handleSubmit}
              onGoogleSignup={form.handleGoogleSignup}
            />

            <div className="mt-6 text-center">
              <p className="text-white/70 text-sm">
                Já tem uma conta?{" "}
                <Link
                  to="/login"
                  className="text-[#C57A3A] font-semibold hover:underline"
                >
                  Fazer login
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-white/60 text-sm mb-3">
              Prefere solicitar um orçamento primeiro?
            </p>
            <Link to="/pedir-orcamento">
              <Button
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                Solicitar orçamento
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
