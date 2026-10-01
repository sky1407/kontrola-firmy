import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SearchForm } from "@/components/SearchForm";
import { normalizeIco } from "@/lib/ico";

export const metadata: Metadata = { title: "Neplatné IČO" };

/** Cieľ vyhľadávacieho formulára: platné IČO presmeruje na kanonickú URL `/firma/{ico}`. */
export default async function SearchPage({ searchParams }: PageProps<"/firma">) {
  const raw = (await searchParams).ico;
  const input = typeof raw === "string" ? raw : "";
  const ico = normalizeIco(input);
  if (ico) redirect(`/firma/${ico}`);

  return (
    <div className="flex flex-col gap-6 py-10">
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        {input ? `„${input}“ nie je platné IČO.` : "Zadajte IČO."} IČO má 6 až 8 číslic.
      </div>
      <SearchForm defaultValue={input} />
    </div>
  );
}
