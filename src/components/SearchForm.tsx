import Form from "next/form";

/** Vyhľadávanie podľa IČO; odošle GET na `/firma?ico=…`, kde sa vstup validuje. */
export function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <Form action="/firma" className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="ico" className="sr-only">
        IČO
      </label>
      <input
        id="ico"
        name="ico"
        defaultValue={defaultValue}
        inputMode="numeric"
        autoComplete="off"
        placeholder="Zadajte IČO, napr. 31322832"
        required
        maxLength={12}
        className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900"
      />
      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Overiť firmu
      </button>
    </Form>
  );
}
