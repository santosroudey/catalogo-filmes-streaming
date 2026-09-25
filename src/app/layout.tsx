import type { Metadata } from "next";
import Link from "next/link";
import { Attribution } from "@/components/Attribution";
import { UserMenu } from "@/components/UserMenu";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Roudey Cine — Filmes no streaming", template: "%s | Roudey Cine" },
  description: "Filmes disponíveis agora nos serviços de streaming do Brasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800">
          <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
            <Link href="/" className="group flex items-center gap-3">
              <span aria-hidden className="text-3xl">🎬</span>
              <span className="flex flex-col leading-tight">
                <span className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Roudey <span className="text-red-500 group-hover:text-red-400">Cine</span>
                </span>
                <span className="text-xs text-neutral-400">Filmes no streaming, agora</span>
              </span>
            </Link>
            <form action="/busca" className="ml-auto">
              <input name="q" placeholder="Buscar filme…" aria-label="Buscar filme"
                className="rounded bg-neutral-800 px-3 py-1 text-sm" />
            </form>
            <UserMenu />
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <Attribution />
      </body>
    </html>
  );
}
