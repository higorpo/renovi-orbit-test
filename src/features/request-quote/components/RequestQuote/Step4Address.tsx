import { MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCEP } from "@/lib/masks";
import { useStep4Address } from "../../hooks/useStep4Address";
import type { Step4Data } from "./schemas";

export interface Step4AddressProps {
  user: { id: string } | null;
  onStep4DataChange: (payload: Step4Data) => void;
}

export function Step4Address({ user, onStep4DataChange }: Step4AddressProps) {
  const {
    step4FormData,
    setStep4FormData,
    selectedAddressId,
    setSelectedAddressId,
    showNewAddressForm,
    setShowNewAddressForm,
    fetchingCep,
    addresses,
    handleCepBlur,
  } = useStep4Address({ userId: user?.id ?? null, onStep4DataChange });

  if (user && addresses.length > 0 && !showNewAddressForm) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-white">Endereço do serviço</h2>
        <p className="text-white/80">Escolha um endereço ou cadastre um novo.</p>
        <div className="space-y-2">
          {addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => setSelectedAddressId(addr.id)}
              className={`w-full text-left p-4 rounded-lg border transition ${
                selectedAddressId === addr.id
                  ? "border-primary bg-white/10"
                  : "border-white/20 hover:bg-white/5"
              } text-white`}
            >
              <div className="flex items-center gap-2">
                {selectedAddressId === addr.id && <Check className="h-4 w-4" />}
                <span>
                  {addr.street}, {addr.number}
                </span>
              </div>
              <span className="text-sm text-white/70">
                {addr.neighborhood}, {addr.city} - {addr.state}
              </span>
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/30 text-white"
          onClick={() => {
            setShowNewAddressForm(true);
            setSelectedAddressId(null);
          }}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Cadastrar novo endereço
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Endereço do serviço</h2>
      {showNewAddressForm && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-white/80"
          onClick={() => setShowNewAddressForm(false)}
        >
          Voltar para meus endereços
        </Button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-white/90">CEP</Label>
          <Input
            value={step4FormData.address_zip}
            onChange={(e) =>
              setStep4FormData((prev) => ({ ...prev, address_zip: maskCEP(e.target.value) }))
            }
            onBlur={handleCepBlur}
            placeholder="00000-000"
            className="bg-white/10 border-white/30 text-white"
          />
          {fetchingCep && <p className="text-xs text-white/60 mt-1">Buscando...</p>}
        </div>
        <div>
          <Label className="text-white/90">Rua</Label>
          <Input
            value={step4FormData.address_street}
            onChange={(e) =>
              setStep4FormData((prev) => ({ ...prev, address_street: e.target.value }))
            }
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">Número</Label>
          <Input
            value={step4FormData.address_number}
            onChange={(e) =>
              setStep4FormData((prev) => ({ ...prev, address_number: e.target.value }))
            }
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">Complemento</Label>
          <Input
            value={step4FormData.address_complement}
            onChange={(e) =>
              setStep4FormData((prev) => ({ ...prev, address_complement: e.target.value }))
            }
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">Bairro</Label>
          <Input
            value={step4FormData.address_neighborhood}
            onChange={(e) =>
              setStep4FormData((prev) => ({ ...prev, address_neighborhood: e.target.value }))
            }
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">Cidade</Label>
          <Input
            value={step4FormData.address_city}
            onChange={(e) =>
              setStep4FormData((prev) => ({ ...prev, address_city: e.target.value }))
            }
            className="bg-white/10 border-white/30 text-white"
          />
        </div>
        <div>
          <Label className="text-white/90">UF</Label>
          <Input
            value={step4FormData.address_state}
            onChange={(e) =>
              setStep4FormData((prev) => ({
                ...prev,
                address_state: e.target.value.toUpperCase().slice(0, 2),
              }))
            }
            placeholder="SC"
            className="bg-white/10 border-white/30 text-white w-20"
          />
        </div>
      </div>
    </div>
  );
}
