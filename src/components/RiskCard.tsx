import type { RiskAssessment, Severity } from "@/lib/risk";

const LEVEL_STYLES: Record<RiskAssessment["level"], { label: string; className: string }> = {
  low: { label: "Nízke riziko", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  medium: { label: "Stredné riziko", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  high: { label: "Vysoké riziko", className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
};

const SEVERITY_LABEL: Record<Severity, string> = {
  high: "Vážne",
  medium: "Stredné",
  low: "Mierne",
  info: "Info",
};

const SEVERITY_DOT: Record<Severity, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-yellow-400",
  info: "bg-slate-400",
};

export function RiskCard({ risk }: { risk: RiskAssessment }) {
  const level = LEVEL_STYLES[risk.level];
  return (
    <section aria-labelledby="risk-heading" className="rounded-xl border border-slate-200 p-6 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="risk-heading" className="text-lg font-semibold">
          Hodnotenie rizika
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-semibold tabular-nums">
            {risk.score}
            <span className="text-base font-normal text-slate-500">/100</span>
          </span>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${level.className}`}>{level.label}</span>
        </div>
      </div>

      {risk.flags.length === 0 ? (
        <p className="mt-4 text-slate-600 dark:text-slate-400">V dostupných dátach sme nenašli žiadne varovné signály.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {risk.flags.map((flag) => (
            <li key={flag.code} className="flex items-start gap-3">
              <span className={`mt-2 size-2 shrink-0 rounded-full ${SEVERITY_DOT[flag.severity]}`} aria-hidden />
              <span>
                <span className="sr-only">{SEVERITY_LABEL[flag.severity]}: </span>
                {flag.message}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Skóre začína na 100; vážne upozornenie −40, stredné −20, mierne −10. Hodnotíme len verejné účtovné dáta.
      </p>
    </section>
  );
}
