import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";

const EXAMPLES = [
  { ico: "31322832", label: "Slovnaft (veľká firma, IFRS v PDF)" },
  { ico: "56813279", label: "Travel Tech (nová s.r.o.)" },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-10 py-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Overte firmu skôr, ako jej pošlete faktúru</h1>
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Zadajte IČO a získate finančný vývoj za posledných 5 rokov a zrozumiteľné upozornenia na riziká – záporné
          vlastné imanie, opakované straty či nepodané účtovné závierky.
        </p>
      </section>

      <SearchForm />

      <section className="text-sm text-slate-600 dark:text-slate-400">
        <p className="mb-2 font-medium">Vyskúšajte:</p>
        <ul className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <li key={example.ico}>
              <Link
                href={`/firma/${example.ico}`}
                className="inline-block rounded-full border border-slate-300 px-3 py-1 hover:border-blue-600 hover:text-blue-600 dark:border-slate-700"
              >
                {example.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
