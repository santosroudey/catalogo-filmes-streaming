"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <p className="mb-4">Não conseguimos carregar os filmes agora.</p>
      <button onClick={reset} className="rounded bg-white px-4 py-2 text-black">Tentar novamente</button>
    </div>
  );
}
