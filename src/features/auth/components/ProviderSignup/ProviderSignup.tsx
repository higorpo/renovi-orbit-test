import { Link } from "react-router";
import { Briefcase } from "lucide-react";
import { useProviderSignupForm } from "../../hooks/useProviderSignupForm";
import { ProviderSignupForm } from "./ProviderSignupForm";

export default function ProviderSignup() {
  const form = useProviderSignupForm();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/hero-provider.jpg)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/95 via-[#1E3A8A]/90 to-black/80" />
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
            <div className="inline-flex items-center gap-2 bg-[#F97316]/20 border border-[#F97316]/30 rounded-full px-4 py-1 mb-4">
              <Briefcase className="h-4 w-4 text-[#F97316]" />
              <span className="text-sm font-medium text-[#F97316]">
                Área do Profissional
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Cadastro de Profissional
            </h1>
            <p className="text-white/70 text-sm md:text-base">
              Comece a receber clientes qualificados na sua região
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6 md:p-8">
            <ProviderSignupForm
              currentStep={form.currentStep}
              formData={form.formData}
              setFormData={form.setFormData}
              errors={form.errors}
              submitting={form.submitting}
              signupSuccess={form.signupSuccess}
              registeredEmail={form.formData.email}
              showPassword={form.showPassword}
              setShowPassword={form.setShowPassword}
              showConfirmPassword={form.showConfirmPassword}
              setShowConfirmPassword={form.setShowConfirmPassword}
              passwordDisplay={form.passwordDisplay}
              onNext={form.handleNext}
              onBack={form.handleBack}
              onSubmit={form.handleSubmit}
              onGoogleSignup={form.handleGoogleSignup}
            />

            {!form.signupSuccess && (
              <div className="mt-6 text-center">
                <p className="text-white/70 text-sm">
                  Já tem uma conta?{" "}
                  <Link
                    to="/login"
                    className="text-[#F97316] font-semibold hover:underline"
                  >
                    Fazer login
                  </Link>
                </p>
              </div>
            )}
          </div>

          {!form.signupSuccess && (
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-2xl font-bold text-[#F97316]">0%</p>
                <p className="text-xs text-white/60">Taxa de cadastro</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-2xl font-bold text-[#F97316]">24h</p>
                <p className="text-xs text-white/60">Aprovação rápida</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-2xl font-bold text-[#F97316]">100%</p>
                <p className="text-xs text-white/60">Pgto garantido</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
