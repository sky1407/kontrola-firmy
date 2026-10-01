import type { RuzReport } from "./client";

/** Kľúčové ukazovatele z jednej závierky v celých eurách; `null` = údaj chýba. */
export interface FinancialFigures {
  totalAssets: number | null;
  equity: number | null;
  liabilities: number | null;
  revenue: number | null;
  netProfit: number | null;
}

export interface ReportFigures {
  current: FinancialFigures;
  previous: FinancialFigures;
}

interface TableLayout {
  /** Počet dátových stĺpcov na riadok v `obsah.tabulky[i].data`. */
  columns: number;
  /** Stĺpec bežného obdobia; predchádzajúce obdobie je hneď za ním. */
  currentColumn: number;
}

/** Riadky sú 0-based indexy v rámci tabuľky (číslo riadku z výkazu mínus prvé číslo riadku tabuľky). */
interface Cell {
  table: number;
  rows: number[];
}

interface TemplateMapping {
  tables: TableLayout[];
  metrics: Record<keyof FinancialFigures, Cell>;
}

const BALANCE_SHEET_AND_PL = { columns: 2, currentColumn: 0 } as const;

/**
 * Mapovanie podporovaných šablón RÚZ (podvojné účtovníctvo). Tabuľky: aktíva, pasíva, výkaz ziskov a strát.
 * Ostatné šablóny (neziskovky, IFRS v PDF, …) nemajú štruktúrované čísla, ktoré vieme porovnať.
 */
const TEMPLATES: Record<number, TemplateMapping> = {
  // Úč MUJ – mikro účtovná jednotka
  687: {
    tables: [BALANCE_SHEET_AND_PL, BALANCE_SHEET_AND_PL, BALANCE_SHEET_AND_PL],
    metrics: {
      totalAssets: { table: 0, rows: [0] }, // r. 01 SPOLU MAJETOK
      equity: { table: 1, rows: [1] }, // r. 25 A. Vlastné imanie
      liabilities: { table: 1, rows: [10] }, // r. 34 B. Záväzky
      revenue: { table: 2, rows: [1, 2] }, // r. 02 tržby z tovaru + r. 03 tržby z výrobkov a služieb
      netProfit: { table: 2, rows: [37] }, // r. 38 VH po zdanení
    },
  },
  // Úč POD – malá a veľká účtovná jednotka; aktíva majú brutto, korekciu, netto, netto min. obdobia
  699: {
    tables: [{ columns: 4, currentColumn: 2 }, BALANCE_SHEET_AND_PL, BALANCE_SHEET_AND_PL],
    metrics: {
      totalAssets: { table: 0, rows: [0] }, // r. 01 SPOLU MAJETOK (netto)
      equity: { table: 1, rows: [1] }, // r. 80 A. Vlastné imanie
      liabilities: { table: 1, rows: [22] }, // r. 101 B. Záväzky
      revenue: { table: 2, rows: [0] }, // r. 01 Čistý obrat
      netProfit: { table: 2, rows: [60] }, // r. 61 VH po zdanení
    },
  },
};

export function isSupportedTemplate(templateId: number | undefined): boolean {
  return templateId !== undefined && templateId in TEMPLATES;
}

function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Súčet buniek; `null` iba ak chýbajú všetky (prázdna bunka pri súčte = 0). */
function sumCells(data: string[], layout: TableLayout, rows: number[], column: number): number | null {
  const values = rows.map((row) => parseAmount(data[row * layout.columns + column]));
  if (values.every((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/**
 * Vytiahne kľúčové ukazovatele z výkazu. Vráti `null`, ak šablóna nie je podporovaná
 * alebo výkaz nemá tabuľky. Chýbajúce bunky (napr. skrátené dáta) sa vrátia ako `null`.
 */
export function extractFigures(report: Pick<RuzReport, "idSablony" | "obsah">): ReportFigures | null {
  if (!isSupportedTemplate(report.idSablony)) return null;
  const mapping = TEMPLATES[report.idSablony!];
  const tables = report.obsah?.tabulky;
  if (!tables || tables.length < mapping.tables.length) return null;

  const read = (offset: 0 | 1): FinancialFigures => {
    const figures = {} as FinancialFigures;
    for (const [metric, cell] of Object.entries(mapping.metrics) as [keyof FinancialFigures, Cell][]) {
      const layout = mapping.tables[cell.table];
      figures[metric] = sumCells(tables[cell.table].data, layout, cell.rows, layout.currentColumn + offset);
    }
    return figures;
  };

  return { current: read(0), previous: read(1) };
}
