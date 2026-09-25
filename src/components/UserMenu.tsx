import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export async function UserMenu() {
  const session = await auth();
  if (!session?.user) {
    return (
      <form action={async () => { "use server"; await signIn(); }}>
        <button className="text-sm underline">Entrar</button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/minha-lista">Minha lista</Link>
      <Link href="/conta">Meus serviços</Link>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
        <button className="underline">Sair</button>
      </form>
    </div>
  );
}
