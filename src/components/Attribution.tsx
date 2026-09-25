import Image from "next/image";

export function Attribution() {
  return (
    <footer className="mt-16 border-t border-neutral-800 py-6 text-xs text-neutral-400">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4">
        <Image src="/tmdb-logo.svg" alt="TMDB" width={80} height={12} />
        <p>Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
          Dados de disponibilidade: JustWatch.</p>
      </div>
    </footer>
  );
}
