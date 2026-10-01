/**
 * Normalizuje vstup na 8-miestne IČO (RÚZ aj ostatné registre ho vedú s úvodnými nulami).
 * Akceptuje 6–8 číslic s ľubovoľnými medzerami; inak vráti `null`.
 */
export function normalizeIco(input: string): string | null {
  const digits = input.replace(/\s+/g, "");
  if (!/^\d{6,8}$/.test(digits)) return null;
  const ico = digits.padStart(8, "0");
  return /^0+$/.test(ico) ? null : ico;
}
