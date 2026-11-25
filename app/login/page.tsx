import { isSandbox } from "@/lib/mode";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const qs = await searchParams;
  return (
    <div className="pl-entry">
      <main>
        <img src="/media/logo-original.webp" alt="Pablo & Luca" />
        <h1>Acceso del equipo</h1>
        <p>Entra para gestionar la tienda o preparar pedidos.</p>
        {isSandbox() && <p className="muted">Entorno local de pruebas</p>}
        <form action="/api/auth/login" method="post">
          <input
            type="hidden"
            name="next"
            value={qs.next === "kitchen" ? "kitchen" : "admin"}
          />
          <label>
            Correo electrónico
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {qs.error && (
            <p role="alert" className="failure">
              Revisa el correo y la contraseña.
            </p>
          )}
          <button>Entrar</button>
        </form>
        <Link href="/">Volver a la tienda</Link>
      </main>
    </div>
  );
}
