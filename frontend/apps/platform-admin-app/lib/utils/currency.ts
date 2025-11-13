export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, ""));
}

export function formatPercent(value: number): string {
  const fixed = value.toFixed(2);
  return fixed + "%";
}

const currencyUtils = { formatCurrency, parseCurrency, formatPercent };

export default currencyUtils;
