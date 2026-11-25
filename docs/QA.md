# Verificación de la V1

Pruebas ejecutadas el 25 de noviembre de 2026 en macOS, Node 24, Chrome y una compilación local de Next.js. Las compras de prueba se realizaron con datos sintéticos. Se probaron PostgreSQL en PGlite y dos sesiones independientes en PostgreSQL nativo 18.4. No se enviaron cobros ni correos a servicios externos.

## Resultado de la ejecución

| Validación | Resultado |
|---|---|
| `npm run typecheck` y `npm run build` | Ambas finalizaron correctamente; se generó la compilación de Next.js para servir con `next start`. |
| `npm test` | 15 de 15 pruebas de dominio, acceso y adaptadores aprobadas. |
| `npm run test:e2e` | 6 de 6 recorridos de Playwright aprobados en 16.5 s sobre la compilación local. |
| Carga inicial en Chrome de 320 px | 20 solicitudes completadas y 368 608 bytes transferidos antes de interactuar, incluidos 151 772 bytes de imágenes. Medición local sin simular red móvil. |
| Lista final de seis pizzas | Cocina cerrada. Precios de $149, $149, $159, $209, $259 y $199 MXN en el orden del brief. |

Durante las pruebas se corrigieron la reconfirmación del monto ante un cambio de precio, la navegación entre hosts locales que impedía limpiar el carrito, la recuperación del intento tras un rechazo y el foco de teclado dentro del modal.

## Flujo comprobado

| Criterios del encargo | Evidencia |
|---|---|
| 1–2 · Apertura y disponibilidad | El servidor autoriza el cambio de cocina y una tienda abierta en otra sesión recibe el estado. El cierre bloquea el checkout en backend. |
| 3–7 · Carrito y checkout | Dos Pepperoni y una Tonno personalizada, persistencia tras recargar, instrucciones por unidad y pedido pendiente. Una variación de precio devuelve 409 y permite reconfirmar. |
| 8–10 · Pago y recepción | HMAC y consulta del pago contra un transporte HTTP controlado; la respuesta del proveedor prevalece. Playwright simula el pago y verifica aparición automática y activación del audio Web Audio en el KDS. |
| 11–16 · Producción | Tres unidades con IDs y timestamps de inicio independientes. Se comprueban recarga, extensión de 60 s de una sola unidad, recuperación de red y confirmación manual. Un reloj acelerado comprueba último minuto y vencimiento. |
| 17–21 · Despacho y registro | Recolección completa en Chrome; entrega a domicilio y despacho en dominio. El seguimiento cambia, hay una sola venta, un solo consumo por reserva y avisos deduplicados. |
| 22–26 · CMS y costos | La edición de precio en el drawer actualiza el menú; el cambio de precio de compra recalcula recetas y preserva el costo y precio históricos de la venta. El subtotal de referencia de Pepperoni es $28.28 MXN y su receta inicial figura incompleta. |
| 27–30 · Stock y concurrencia | Agotado y cocina cerrada impiden checkout. Un mismo evento repetido no duplica pedidos, ingresos ni consumos. Dos procesos con sesiones PostgreSQL reales disputan la última bola; se crea una única reserva. |
| 31–33 · Correo y acceso | Un transporte Resend que responde 503 deja la venta en cocina. El reintento usa la misma clave. Se comprueban RLS, rechazo de lectura de finanzas y comprobantes por KITCHEN, seguimiento no secuencial y ausencia de los valores secretos locales en los bundles del navegador. |
| 34 · Responsive | Revisión visual y de interacción en móvil, tablet y escritorio. Se comprueban ausencia de desbordes, ciclo de foco en el modal y retorno al control de origen con Escape. |

## Otras comprobaciones

- Importes y moneda incompatibles, aprobaciones posteriores a la expiración, segundo pago con otro ID, rechazo, cancelación y reembolsos parciales y completos. Un pago tardío entra a revisión y conserva el stock de la compra que sí alcanzó a reservarlo.
- Cupo físico de una sola plaza y cola de producción. El vencimiento del reloj mantiene el aviso hasta la acción del operador. El ensayo de sonido comprueba la creación y reproducción programada de osciladores en el navegador. Queda por medir su audibilidad en la cocina.
- Aplicación repetida del seed, permisos sobre tablas y señales de Realtime en PostgreSQL local, compra y merma, conversiones de unidad y atribución de ventas por canal.
- Subida y lectura de un comprobante desde una sesión administrativa, exportación CSV y denegación al rol de cocina. Los manifiestos de instalación permiten abrir la ruta de cocina directamente.
- `npm audit --omit=dev` informó cero avisos conocidos. El control de secretos comparó los cuatro valores sensibles generados por el sandbox contra los archivos JavaScript de producción, sin coincidencias.
- El adaptador de PostgreSQL negoció TLS 1.3. Se verificó rechazo de una CA ajena y de un hostname incorrecto. [Detalle del ensayo nativo](DATABASE.md#concurrencia-y-tls-en-postgresql-nativo)

## Capturas

| Superficie | Evidencia |
|---|---|
| Tienda | [Escritorio](qa/store-desktop.png) · [Tablet](qa/store-tablet.png) · [Móvil](qa/store-mobile.png) · [Personalización](qa/store-customization-mobile.png) |
| CMS | [Edición de una pizza](qa/cms-drawer-desktop.png) · [Móvil](qa/cms-mobile.png) |
| ERP | [Pulso del Negocio](qa/erp-desktop.png) · [Recetas en tablet](qa/recipes-tablet.png) |
| KDS | [Tres pizzas en el horno](qa/kds-active.png) · [Escritorio](qa/kds-desktop.png) · [Móvil](qa/kds-mobile.png) |

## Límite del ensayo
La prueba del proveedor utilizó respuestas controladas. Faltan la compra y el reembolso de prueba en Mercado Pago, la recepción de correo desde un dominio verificado y una sesión sobre Auth, Realtime y Storage alojados en Supabase. La build local pasó por Next.js. Sigue pendiente desplegarla al proyecto comercial de Vercel. La verificación final de operación requiere el dispositivo táctil de la cocina, su altavoz, capacidad real del horno, tarifas, recetas y existencias aprobadas.
