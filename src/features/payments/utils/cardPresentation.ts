export function formatCardExpiry(month: number, year: number): string {
  const normalizedYear = year >= 100 ? String(year).slice(-2) : String(year).padStart(2, "0");
  return `${String(month).padStart(2, "0")}/${normalizedYear}`;
}

export function formatMaskedCardLabel(cardNumberMasked: string): string {
  const digits = cardNumberMasked.replace(/\D/g, "").slice(-4);
  return digits ? `•••• ${digits}` : cardNumberMasked;
}

export function getCardBrandLabel(brand: string): string {
  switch (brand.toUpperCase()) {
    case "VISA":
    case "VCC":
      return "Visa";
    case "MASTER":
    case "MASTERCARD":
      return "Mastercard";
    case "ELO":
      return "Elo";
    default:
      return brand;
  }
}
