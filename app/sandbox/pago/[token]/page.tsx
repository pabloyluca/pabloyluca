import { notFound, redirect } from "next/navigation";
import { getPendingByToken } from "@/lib/domain";
import { isSandbox } from "@/lib/mode";
export const dynamic = "force-dynamic";
export default async function Sandbox({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (process.env.COMMERCE_MODE === "visual-preview" || !isSandbox()) notFound();
  const { token } = await params,
    order = await getPendingByToken(token);
  if (!order) notFound();
  if (order.status !== "pending") redirect("/seguimiento/" + token);
  return (
    <div className="pl-entry">
      <main>
        <img src="/media/logo-original.webp" alt="Pablo & Luca" />
        <p className="muted">Sandbox · Pago de prueba</p>
        <h1>Pedido #{order.number}</h1>
        <p>
          Total{" "}
          <strong>
            {new Intl.NumberFormat("es-MX", {
              style: "currency",
              currency: "MXN",
            }).format(order.total / 100)}{" "}
            MXN
          </strong>
        </p>
        <p>
          Simula la respuesta del proveedor para probar la cocina y el
          seguimiento. El dinero no se mueve.
        </p>
        <form action="/api/sandbox/payment" method="post">
          <input type="hidden" name="token" value={token} />
          <button name="result" value="approved">
            Aprobar pago de prueba
          </button>
          <button
            name="result"
            value="rejected"
            style={{ background: "#785246" }}
          >
            Simular rechazo
          </button>
        </form>
        <a href={"/seguimiento/" + token}>Ver pedido pendiente</a>
      </main>
    </div>
  );
}
