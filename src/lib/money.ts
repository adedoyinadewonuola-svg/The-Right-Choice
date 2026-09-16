const formatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function money(value: unknown): string {
  return formatter.format(num(value));
}

export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
