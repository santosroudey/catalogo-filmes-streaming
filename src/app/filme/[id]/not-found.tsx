import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="mb-4">Filme não encontrado.</p>
      <Link href="/" className="underline">Voltar ao catálogo</Link>
    </div>
  );
}
