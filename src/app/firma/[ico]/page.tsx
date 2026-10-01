import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { FinancialChart, type ChartPoint } from "@/components/FinancialChart";
import { RiskCard } from "@/components/RiskCard";
import { getCompanyReport } from "@/lib/company";
import { formatDate, formatDateTime, formatEur, formatPeriod } from "@/lib/format";
import { normalizeIco } from "@/lib/ico";
import type { FinancialYear } from "@/lib/ruz/profile";

/** Deduplikuje volanie medzi `generateMetadata` a stránkou v rámci jednej požiadavky. */
const loadReport = cache(getCompanyReport);

export async function generateMetadata({ params }: PageProps<"/firma/[ico]">): Promise<Metadata> {
  const ico = normalizeIco((await params).ico);
  const report = ico ? await loadReport(ico) : null;
  return { title: report ? `${report.profile.name} (IČO ${ico})` : "Firma nenájdená" };
}

function toChartPoints(years: FinancialYear[]): ChartPoint[] {
  return years
    .filter((year) => year.figures !== null)
    .reverse()
    .map((year) => ({
      label: formatPeriod(year.periodFrom, year.periodTo),
      revenue: year.figures!.revenue,
      netProfit: year.figures!.netProfit,
      equity: year.figures!.equity,
    }));
}

const amount = (value: number | null | undefined) => (value == null ? "–" : formatEur(value));

export default async function CompanyPage({ params }: PageProps<"/firma/[ico]">) {
  const { ico: rawIco } = await params;
  const ico = normalizeIco(rawIco);
  if (!ico) notFound();
  if (ico !== rawIco) redirect(`/firma/${ico}`);

  const report = await loadReport(ico);
  if (!report) notFound();
  const { profile, risk } = report;
  const chartPoints = toChartPoints(profile.years);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{profile.name}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-slate-600 dark:text-slate-400">
          <div className="flex gap-1">
            <dt>IČO</dt>
            <dd className="font-mono">{profile.ico}</dd>
          </div>
          {profile.dic && (
            <div className="flex gap-1">
              <dt>DIČ</dt>
              <dd className="font-mono">{profile.dic}</dd>
            </div>
          )}
          {profile.foundedOn && (
            <div className="flex gap-1">
              <dt>Založená</dt>
              <dd>{formatDate(profile.foundedOn)}</dd>
            </div>
          )}
          {profile.address && (
            <div className="flex gap-1">
              <dt className="sr-only">Sídlo</dt>
              <dd>{profile.address}</dd>
            </div>
          )}
        </dl>
      </header>

      {(report.stale || profile.incomplete) && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {report.stale
            ? "Register účtovných závierok je momentálne nedostupný – zobrazujeme posledné uložené dáta."
            : "Časť závierok sa nepodarilo načítať, dáta môžu byť neúplné."}
        </div>
      )}

      <RiskCard risk={risk} />

      <section aria-labelledby="finance-heading" className="flex flex-col gap-4">
        <h2 id="finance-heading" className="text-lg font-semibold">
          Finančný vývoj
        </h2>
        {chartPoints.length > 0 ? (
          <FinancialChart points={chartPoints} />
        ) : (
          <p className="text-slate-600 dark:text-slate-400">
            {profile.years.length > 0
              ? "Závierky tejto firmy nie sú v RÚZ v štruktúrovanej podobe (napr. IFRS alebo neziskové organizácie) – nájdete ich v PDF nižšie."
              : "Firma nemá v RÚZ žiadne ročné účtovné závierky."}
          </p>
        )}

        {profile.years.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl text-right text-sm tabular-nums">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <tr>
                  <th scope="col" className="py-2 text-left font-medium">Obdobie</th>
                  <th scope="col" className="py-2 font-medium">Tržby</th>
                  <th scope="col" className="py-2 font-medium">Výsledok hosp.</th>
                  <th scope="col" className="py-2 font-medium">Vlastné imanie</th>
                  <th scope="col" className="py-2 font-medium">Záväzky</th>
                  <th scope="col" className="py-2 font-medium">Aktíva</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">Dokument</span></th>
                </tr>
              </thead>
              <tbody>
                {profile.years.map((year) => (
                  <tr key={year.periodTo} className="border-b border-slate-100 dark:border-slate-900">
                    <th scope="row" className="py-2 text-left font-medium">{formatPeriod(year.periodFrom, year.periodTo)}</th>
                    <td>{amount(year.figures?.revenue)}</td>
                    <td className={year.figures?.netProfit != null && year.figures.netProfit < 0 ? "text-red-600" : undefined}>
                      {amount(year.figures?.netProfit)}
                    </td>
                    <td>{amount(year.figures?.equity)}</td>
                    <td>{amount(year.figures?.liabilities)}</td>
                    <td>{amount(year.figures?.totalAssets)}</td>
                    <td className="pl-4">
                      {year.documentUrl && (
                        <a href={year.documentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">Dáta načítané {formatDateTime(report.fetchedAt)} z Registra účtovných závierok.</p>
    </div>
  );
}
