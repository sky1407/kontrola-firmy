import { mapWithConcurrency } from "../concurrency";
import { RuzError, type RuzClient, type RuzStatement } from "./client";
import { extractFigures, type FinancialFigures } from "./financials";

const RUZ_ATTACHMENT_URL = "https://www.registeruz.sk/cruz-public/domain/financialreport/attachment";
const MAX_YEARS = 5;
const MAX_CONCURRENT_REQUESTS = 3;
/** Priebežné závierky nepokrývajú celý rok, do vývoja ich nemiešame. */
const ANNUAL_STATEMENT_TYPES = new Set(["Riadna", "Mimoriadna"]);

export interface FinancialYear {
  /** Obdobie vo formáte `YYYY-MM`. */
  periodFrom: string;
  periodTo: string;
  /** `null`, ak závierka nemá štruktúrované čísla (napr. IFRS iba v PDF). */
  figures: FinancialFigures | null;
  /** Odkaz na PDF závierky, ak existuje. */
  documentUrl: string | null;
}

export interface CompanyProfile {
  ico: string;
  name: string;
  dic: string | null;
  address: string | null;
  foundedOn: string | null;
  dissolvedOn: string | null;
  naceCode: string | null;
  /** Koniec posledného obdobia, za ktoré firma podala ročnú závierku. */
  lastFiledPeriod: string | null;
  /** Najnovší rok prvý. */
  years: FinancialYear[];
  /** Niektoré požiadavky na RÚZ zlyhali – dáta môžu byť neúplné. */
  incomplete: boolean;
}

function formatAddress(parts: { ulica?: string; psc?: string; mesto?: string }): string | null {
  const cityLine = [parts.psc, parts.mesto].filter(Boolean).join(" ");
  const address = [parts.ulica, cityLine].filter(Boolean).join(", ");
  return address || null;
}

/** Ročné závierky zoskupené podľa konca obdobia, najnovšie obdobie prvé, v rámci obdobia najnovšie podanie prvé. */
function groupByPeriod(statements: RuzStatement[]): RuzStatement[][] {
  const groups = new Map<string, RuzStatement[]>();
  for (const statement of statements) {
    if (!ANNUAL_STATEMENT_TYPES.has(statement.typ)) continue;
    const group = groups.get(statement.obdobieDo) ?? [];
    group.push(statement);
    groups.set(statement.obdobieDo, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, group]) =>
      group.sort((a, b) => (b.datumPodania ?? "").localeCompare(a.datumPodania ?? "")),
    );
}

/**
 * Prejde výkazy závierok daného obdobia a vráti prvé štruktúrované čísla.
 * Pri firmách s individuálnou aj konsolidovanou závierkou tak berieme tú, ktorá má čísla.
 */
async function loadYear(client: RuzClient, candidates: RuzStatement[]): Promise<FinancialYear> {
  const [newest] = candidates;
  let documentUrl: string | null = null;

  for (const statement of candidates) {
    for (const reportId of statement.idUctovnychVykazov) {
      const report = await client.getReport(reportId);
      if (!report) continue;
      const figures = extractFigures(report);
      if (figures) {
        return { periodFrom: statement.obdobieOd, periodTo: statement.obdobieDo, figures: figures.current, documentUrl };
      }
      const pdf = report.prilohy.find((attachment) => attachment.mimeType === "application/pdf");
      if (!documentUrl && pdf) documentUrl = `${RUZ_ATTACHMENT_URL}/${pdf.id}`;
    }
  }
  return { periodFrom: newest.obdobieOd, periodTo: newest.obdobieDo, figures: null, documentUrl };
}

/**
 * Zostaví profil firmy z RÚZ: základné údaje a kľúčové ukazovatele za posledných 5 rokov.
 * Vráti `null`, ak firma s daným IČO v RÚZ neexistuje. Zlyhanie jednotlivých závierok
 * neruší celý profil, iba ho označí ako `incomplete`; zlyhanie vyhľadania firmy sa propaguje.
 */
export async function getCompanyProfile(client: RuzClient, ico: string): Promise<CompanyProfile | null> {
  const entity = await client.findEntityByIco(ico);
  if (!entity) return null;

  let incomplete = false;
  const tolerate = async <T>(promise: Promise<T>): Promise<T | null> => {
    try {
      return await promise;
    } catch (error) {
      if (!(error instanceof RuzError)) throw error;
      incomplete = true;
      return null;
    }
  };

  const statements = (
    await mapWithConcurrency(entity.idUctovnychZavierok, MAX_CONCURRENT_REQUESTS, (id) =>
      tolerate(client.getStatement(id)),
    )
  ).filter((statement): statement is RuzStatement => statement !== null);

  const periods = groupByPeriod(statements);
  const years = (
    await mapWithConcurrency(periods.slice(0, MAX_YEARS), MAX_CONCURRENT_REQUESTS, (candidates) =>
      tolerate(loadYear(client, candidates)),
    )
  ).filter((year): year is FinancialYear => year !== null);

  return {
    ico: entity.ico,
    name: entity.nazovUJ,
    dic: entity.dic ?? null,
    address: formatAddress(entity),
    foundedOn: entity.datumZalozenia ?? null,
    dissolvedOn: entity.datumZrusenia ?? null,
    naceCode: entity.skNace ?? null,
    lastFiledPeriod: periods[0]?.[0].obdobieDo ?? null,
    years,
    incomplete,
  };
}
