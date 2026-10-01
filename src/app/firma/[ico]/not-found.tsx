import { SearchForm } from "@/components/SearchForm";

export default function CompanyNotFound() {
  return (
    <div className="flex flex-col gap-6 py-10">
      <h1 className="text-2xl font-semibold">Firmu sme nenašli</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Register účtovných závierok neeviduje účtovnú jednotku s týmto IČO. Živnostníci v jednoduchom účtovníctve
        závierky nepodávajú.
      </p>
      <SearchForm />
    </div>
  );
}
