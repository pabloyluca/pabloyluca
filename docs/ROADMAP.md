# Resultado por fase

Avance local del 25 de noviembre de 2026. Los commits pertenecen a la rama local `main` del repositorio `pabloyluca/pabloyluca`. La revisión comercial de los servicios externos sigue pendiente.

| Fase | Entrega y verificación local | Pendiente o decisión | Commit de implementación |
|---|---|---|---|
| 0 · Discovery | Ocho originales inspeccionados, dimensiones y huellas verificadas. Remoto vacío confirmado. | La cuenta conectada permite lectura de GitHub. Falta identificar los proyectos comerciales de Vercel y Supabase. | `b11a0c2` |
| 1 · Diseño | Identidad original, patrón vectorial, componentes responsivos e iconos PWA. | Fotos de 226 × 159 px como material provisional. Zaslia queda sujeta a licencia. | `3bcc768` |
| 2 · Tienda | Menú nativo, personalización, carrito persistente, recolección, domicilio y seguimiento por token. Pruebas en Chrome. | El domicilio se habilita al definir tarifas y códigos postales. | `7272a7b` |
| 3 · CMS y persistencia | Catálogo, fotos, configuración, Auth SSR y migraciones. Se comprobó el cambio de precio desde el drawer y la separación de roles SQL. | Validar Auth, Storage y Realtime en la cuenta de Supabase de la marca. | `21a28cc` |
| 4 · Comercio | Checkout transaccional, idempotencia, vencimiento y conciliación. Dos conexiones PostgreSQL disputaron la última bola. | Completar compra de prueba y reembolso en Mercado Pago. | `5a02532` |
| 5 · Cocina | Recepción de pagos confirmados en sandbox, alertas, cronómetros persistentes por unidad y despacho. | Verificar volumen, visibilidad y bloqueo de pantalla con el dispositivo físico definitivo. | `0bd7ad3` |
| 6 · Resend | Plantillas, bitácora, trabajador y resumen diario. Se ensayó fallo de transporte y reintento sin duplicar. | Verificar DNS, remitente y llegada a una bandeja real autorizada. | `b7d0d94` |
| 7 · ERP | Compras, recetas parciales, costos históricos, producción de masa, inventario, simulador, canales y CSV. | Completar gramajes, existencias reales, empaque y comisiones del negocio. | `e6ca91f` |
| 8 · LU | Herramientas sobre el dominio compartido, atribución de canal y adaptador de WhatsApp. | Conectar un número autorizado, consentimiento, templates y atención humana en una fase posterior. | `813e947` |
| 9 · QA | Pruebas locales de dominio, roles, adaptadores y navegador con capturas. | La validación externa requiere las cuentas de la marca y una preview de Vercel. | Ver historial local y [QA](QA.md). |

**Vista local** · [Tienda](http://127.0.0.1:3217) · [Administración](http://127.0.0.1:3217/admin) · [Cocina](http://127.0.0.1:3217/kitchen)

La cocina arranca cerrada. El sandbox habilita el simulador de pago y deja registro de los correos de prueba. El [procedimiento de activación](DEPLOYMENT.md) describe qué validar antes del primer cobro real.
