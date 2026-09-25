import type { Metadata } from "next";
import Link from "next/link";
import { Attribution } from "@/components/Attribution";
import "./globals.css";

export const metadata: Metadata = {
  title: "Em Cartaz no Streaming",
  description: "Filmes disponíveis agora nos serviços de streaming do Brasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-950 text-neutral-100">
        <header className="border-b border-neutral-800">
          <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
            <Link href="/" className="font-bold">Em Cartaz no Streaming</Link>
            <form action="/busca" className="ml-auto">
              <input name="q" placeholder="Buscar filme…" aria-label="Buscar filme"
                className="rounded bg-neutral-800 px-3 py-1 text-sm" />
            </form>
            {/* Task 9 adiciona aqui <UserMenu /> */}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <Attribution />
      </body>
    </html>
  );
}
