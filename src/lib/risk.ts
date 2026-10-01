import { formatEur } from "./format";
import type { CompanyProfile } from "./ruz/profile";

export type Severity = "high" | "medium" | "low" | "info";

export interface RiskFlag {
  code:
    | "DISSOLVED"
    | "NEGATIVE_EQUITY"
    | "MISSING_FILING"
    | "CONSECUTIVE_LOSSES"
    | "LOSS_LAST_YEAR"
    | "YOUNG_COMPANY";
  severity: Severity;
  /** Zrozumiteľné vysvetlenie pre používateľa – skóre nesmie byť čierna skrinka. */
  message: string;
}

export interface RiskAssessment {
  /** 0–100, vyššie = bezpečnejšie. */
  score: number;
  level: "low" | "medium" | "high";
  flags: RiskFlag[];
}

const PENALTY: Record<Severity, number> = { high: 40, medium: 20, low: 10, info: 0 };
const CONSECUTIVE_LOSS_YEARS = 3;
/** Závierka sa podáva do 30. 6.; v RÚZ sa objaví s oneskorením, preto rátame až od augusta. */
const FILING_VISIBLE_FROM_MONTH = 7; // 0-based: august

/** Posledný kalendárny rok, za ktorý by už mala byť závierka v RÚZ. */
function expectedFilingYear(now: Date): number {
  return now.getUTCFullYear() - (now.getUTCMonth() >= FILING_VISIBLE_FROM_MONTH ? 1 : 2);
}

const yearOf = (isoLike: string) => Number(isoLike.slice(0, 4));

/**
 * Transparentné pravidlá rizika postavené na dátach z RÚZ.
 * `now` je parameter kvôli deterministickým testom.
 */
export function assessRisk(profile: CompanyProfile, now: Date = new Date()): RiskAssessment {
  const flags: RiskFlag[] = [];
  const withFigures = profile.years.filter((year) => year.figures !== null);
  const latest = withFigures[0]?.figures;

  if (profile.dissolvedOn) {
    flags.push({ code: "DISSOLVED", severity: "high", message: `Účtovná jednotka bola zrušená ${profile.dissolvedOn}.` });
  }

  if (latest?.equity != null && latest.equity < 0) {
    flags.push({
      code: "NEGATIVE_EQUITY",
      severity: "high",
      message: `Záporné vlastné imanie (${formatEur(latest.equity)}) – záväzky prevyšujú majetok.`,
    });
  }

  const expectedYear = expectedFilingYear(now);
  const foundedYear = profile.foundedOn ? yearOf(profile.foundedOn) : null;
  const shouldHaveFiled = !profile.dissolvedOn && (foundedYear === null || foundedYear <= expectedYear);
  const lastFiledYear = profile.lastFiledPeriod ? yearOf(profile.lastFiledPeriod) : null;
  if (shouldHaveFiled && (lastFiledYear === null || lastFiledYear < expectedYear)) {
    flags.push({
      code: "MISSING_FILING",
      severity: "high",
      message:
        lastFiledYear === null
          ? "Firma v RÚZ nemá žiadnu ročnú účtovnú závierku."
          : `Chýba účtovná závierka za rok ${expectedYear} (posledná je za ${lastFiledYear}).`,
    });
  }

  const recentProfits = withFigures.slice(0, CONSECUTIVE_LOSS_YEARS).map((year) => year.figures!.netProfit);
  if (recentProfits.length === CONSECUTIVE_LOSS_YEARS && recentProfits.every((profit) => profit !== null && profit < 0)) {
    flags.push({
      code: "CONSECUTIVE_LOSSES",
      severity: "medium",
      message: `Strata ${CONSECUTIVE_LOSS_YEARS} roky po sebe.`,
    });
  } else if (latest?.netProfit != null && latest.netProfit < 0) {
    flags.push({
      code: "LOSS_LAST_YEAR",
      severity: "low",
      message: `Strata v poslednom roku (${formatEur(latest.netProfit)}).`,
    });
  }

  if (profile.foundedOn) {
    const ageMs = now.getTime() - new Date(profile.foundedOn).getTime();
    if (ageMs < 365 * 24 * 60 * 60 * 1000) {
      flags.push({ code: "YOUNG_COMPANY", severity: "info", message: "Firma existuje menej ako rok." });
    }
  }

  const score = Math.max(0, 100 - flags.reduce((sum, flag) => sum + PENALTY[flag.severity], 0));
  const level = score >= 80 ? "low" : score >= 50 ? "medium" : "high";
  return { score, level, flags };
}
