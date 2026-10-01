"use client";

import { useEffect } from "react";

/** Zachytí výpadok RÚZ, keď pre firmu ešte nemáme uložené dáta. */
export default function CompanyError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4 py-10">
      <h1 className="text-2xl font-semibold">Register je dočasne nedostupný</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Nepodarilo sa načítať údaje z Registra účtovných závierok. Skúste to prosím o chvíľu.
      </p>
      <button
        type="button"
        onClick={retry}
        className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
      >
        Skúsiť znova
      </button>
    </div>
  );
}
