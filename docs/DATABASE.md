# Base de datos de Pablo & Luca

Producción utiliza una base PostgreSQL de Supabase. El proceso de Next.js se conecta con `DATABASE_URL` usando TLS y transacciones. En el sandbox local, PGlite ejecuta las mismas migraciones y el mismo seed. La primera ejecución de sandbox agrega existencias ficticias y un lote listo para que se pueda ensayar el flujo. El seed comercial deja la cocina cerrada, el inventario a cero y las tarifas de reparto sin configurar.

## Modelo

| Área | Tablas | Regla |
| --- | --- | --- |
| Acceso y configuración | profiles, store_settings, store_signals | El perfil se enlaza con Supabase Auth. Las señales sólo contienen el nombre del canal y su versión. |
| Tienda | products, product_ingredient_labels, delivery_zones, promotions | El producto mantiene ingredientes visibles y removibles. Las zonas usan códigos postales explícitos. Archivar conserva los pedidos anteriores. |
| Recetas | ingredients, recipes, recipe_items, ingredient_purchases | Los gramajes se normalizan por dimensión. Cada precio de compra se registra en centavos. Una receta incompleta devuelve costo parcial y deja el costo total sin calcular. Antes de confirmar el costo completo deben registrarse masa, toppings y empaque. Los cambios en la composición del producto vuelven a abrir la validación. |
| Producción | dough_batches, ovens, inventory_reservations, inventory_movements | Las reservas pendientes descuentan disponibilidad. El horno tiene capacidad definida. Los movimientos de consumo enlazan de forma única con la reserva. |
| Pedidos | orders, order_items, order_item_units | Cada línea congela nombre, foto, precio, costo y personalizaciones. Cada pizza física tiene unidad, estado, inicio, vencimiento esperado y final confirmado. |
| Pagos y finanzas | payment_preferences, payments, payment_events, sales_channels, finance_sales, expenses | La venta tiene una sola fila por pedido. Los reembolsos se acumulan por pago. Los costos de las unidades corresponden a su receta en el checkout. |
| Operación | notification_events, rate_limits, audit_logs, support_requests | La cola de correos conserva destinatario, evento, contenido, intentos y resultado. El registro de auditoría identifica al operador de cada acción administrativa. |

Los importes de venta se expresan en centavos MXN de tipo entero. Los insumos usan NUMERIC para existencias y costo por unidad. Una onza de peso corresponde a 28.349523125 g y una onza fluida estadounidense a 29.5735295625 ml. El sistema exige que la unidad de compra pertenezca a la dimensión base del insumo. Las fechas operativas con hora usan timestamptz y el día comercial se calcula en America/Cancun.

## Transacciones e historial

La transacción de checkout obtiene un bloqueo de fila en la configuración de la tienda. El mismo bloqueo serializa pagos y cambios administrativos. Para una sola cocina, este diseño permite verificar juntos el estado abierto, los ingredientes, la promoción, el código postal, las bolas disponibles y la capacidad de pedidos. La clave de reintento se vincula con una huella del carrito y sus datos de entrega. La reserva dura 15 minutos. Se asignan primero las bolas del lote con caducidad más próxima. La lectura pública descarta reservas vencidas y la conciliación las libera al procesar una operación o al ejecutar mantenimiento.

El backend concilia la referencia, el importe y la moneda del pago verificado. La aprobación consume las reservas, registra movimientos, crea la venta y encola notificaciones en una sola transacción. La devolución o el contracargo modifica el registro financiero sin devolver automáticamente alimentos usados al inventario. Un pago tardío o incompatible queda en revisión operativa. Cambiar tarifas, recetas o precios después de la compra conserva los snapshots originales. Un artículo con costo incompleto deja su venta con costo total desconocido.

Las personalizaciones enlazadas con un insumo descuentan la cantidad retirada al reservar y calcular su costo. El catálogo inicial sólo incluye gramajes documentados. Antes de operar deben completarse las cantidades reales de toppings, masa, salsa y empaque, así como la composición de cada pizza. El registro de un lote consume la harina de su producción. Cuando se limita por bolas de masa, el checkout evita consumir otra vez líneas de la categoría masa.

## Acceso y entrega de eventos

Las tablas comerciales tienen RLS. El esquema de Supabase retira permisos a anon y authenticated en los datos operativos. Las rutas de servidor verifican el usuario y su rol antes de acceder por la conexión privilegiada. KITCHEN recibe una proyección de producción con unidades y notas, y únicamente puede ejecutar acciones de horno y despacho. El cliente usa un token aleatorio de seguimiento de 256 bits. La página de seguimiento omite el nombre, teléfono, dirección y correo.

Supabase Realtime publica actualizaciones de store_signals. El canal público informa cambios de tienda o seguimiento. Las políticas habilitan las señales de cocina a personal autorizado y las administrativas a ADMIN/OWNER. Tras una señal, cada cliente vuelve a solicitar su proyección. La transacción que genera la señal también guarda los nuevos timestamps del horno.

El worker de correo reclama eventos con FOR UPDATE SKIP LOCKED y un arrendamiento de cinco minutos. Usa una clave duradera de deduplicación y limita los reintentos a cinco y a la ventana de reintento del proveedor. El correo confirmado, fallido o simulado conserva su estado. La cocina puede operar aunque el envío falle.

## Preparación y validación

Aplicar en orden las migraciones de `supabase/migrations` sobre el proyecto comercial confirmado, seguidas de `supabase/seed.sql`. El seed marca su primera ejecución dentro de la transacción y conserva cambios editoriales al volver a ejecutarse. El primer OWNER se asigna por un administrador de la base después de crear el usuario en Supabase Auth. Usar el UUID del usuario verificado en profiles.

La suite de dominio usa PGlite con las migraciones completas. La prueba de permisos crea roles PostgreSQL anon y authenticated y una identidad Auth local para probar las políticas con SET ROLE. La comprobación de sesiones y Realtime contra la cuenta comercial de Supabase requiere el proyecto definitivo.
