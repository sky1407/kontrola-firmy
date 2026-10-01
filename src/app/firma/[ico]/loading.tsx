export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true" aria-label="Načítavam údaje z registra">
      <div className="h-9 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-80 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <p className="text-sm text-slate-500">Načítavam závierky z registra, prvé vyhľadanie môže trvať niekoľko sekúnd…</p>
    </div>
  );
}
