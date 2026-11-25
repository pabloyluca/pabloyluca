# Arquitectura
Hay una aplicación Next.js App Router con TypeScript estricto. Una misma capa de dominio calcula la disponibilidad, crea la orden y confirma el pago para el checkout y las futuras herramientas de LU. Las rutas HTTP validan sesión, rol, origen y datos de entrada. PostgreSQL conserva el estado del negocio. Los clientes reciben proyecciones distintas para tienda, cocina y administración.

| Límite | Responsabilidad |
|---|---|
| `app/`, `components/store/`, `components/ops/` | Experiencia pública, sesión del equipo y pantallas operativas |
| `lib/domain/`, `lib/db/` | Transacciones, reglas de venta, snapshots, stock y reserva de capacidad |
| `lib/integrations/` | Firma y consulta de Mercado Pago, plantillas y entrega de Resend |
| `lib/lu/` | Herramientas de venta y contrato de transporte a WhatsApp |
| `supabase/` | Esquema, acceso, índices y semillas idempotentes |

## Una orden de principio a fin
1. El navegador envía identificadores, cantidades, notas y una clave idempotente. El servidor relee el menú, verifica cobertura, cupo e inventario y guarda precios en centavos.
2. Una transacción reserva ingredientes y bolas de masa y crea las unidades individuales. El checkout tiene una ventana de 15 minutos. Antes de aceptar otra orden, la base libera las reservas vencidas.
3. El comprador paga en el proveedor. La URL de retorno abre el seguimiento. El webhook autenticado consulta al proveedor y valida la operación antes de consumir existencias, registrar la venta, confirmar cocina y encolar avisos.
4. El KDS recibe una señal y consulta los pedidos autorizados. Al iniciar una unidad, el servidor verifica el espacio y guarda sus timestamps. El navegador pinta la cuenta atrás. El operador confirma cada unidad, el pedido completo y la entrega.
5. Las notificaciones se procesan después de la transacción. Un fallo de correo conserva tanto la venta como el pedido en cocina.

## Sesiones y actualización de pantallas
Supabase Auth identifica al personal. El servidor consulta `profiles` al autorizar una operación. El flujo local usa cookies firmadas y contraseñas independientes para OWNER y KITCHEN. El seguimiento público requiere un token aleatorio de 256 bits y devuelve un resumen de estado.

El menú inicial se renderiza en el servidor. En Supabase, Realtime transmite cambios sobre filas de señal por audiencia. En el proceso local, EventSource distribuye invalidaciones tras mutaciones. En ambos casos los clientes recuperan el estado desde su ruta autorizada. La PWA permite instalar la tienda, administración y cocina con entradas propias. El service worker conserva iconos y una página de desconexión. Los pedidos, las sesiones y el inventario se consultan por red.
