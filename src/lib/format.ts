const eurFormatter = new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const compactEurFormatter = new Intl.NumberFormat("sk-SK", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat("sk-SK", { dateStyle: "medium", timeZone: "Europe/Bratislava" });
const dateTimeFormatter = new Intl.DateTimeFormat("sk-SK", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Bratislava",
});

export const formatEur = (value: number) => eurFormatter.format(value);
export const formatEurCompact = (value: number) => compactEurFormatter.format(value);
/** Formátuje ISO dátum (`YYYY-MM-DD`) alebo `Date`. */
export const formatDate = (value: string | Date) => dateFormatter.format(new Date(value));
export const formatDateTime = (value: Date) => dateTimeFormatter.format(value);

/** `2025-01` – `2025-12` → `2025`; neštandardné obdobie (napr. založenie v priebehu roka) → `02/2025 – 12/2025`. */
export function formatPeriod(from: string, to: string): string {
  const [fromYear, fromMonth] = from.split("-");
  const [toYear, toMonth] = to.split("-");
  if (fromYear === toYear && fromMonth === "01" && toMonth === "12") return toYear;
  return `${fromMonth}/${fromYear} – ${toMonth}/${toYear}`;
}
