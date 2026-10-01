import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: "Kontrola firmy podľa IČO", template: "%s · Kontrola firmy" },
  description:
    "Overte slovenskú firmu pred spoluprácou: finančný vývoj z Registra účtovných závierok a transparentné upozornenia na riziká.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sk" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-slate-200 dark:border-slate-800">
          <div className="mx-auto flex max-w-4xl items-center px-4 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              Kontrola firmy
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-slate-800">
          Dáta: Register účtovných závierok (registeruz.sk). Informatívny nástroj, nie právne ani finančné poradenstvo.
        </footer>
      </body>
    </html>
  );
}
