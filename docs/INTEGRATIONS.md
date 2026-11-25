# Integraciones
| Servicio | Adaptador | Validación pendiente |
|---|---|---|
| Supabase | PostgreSQL por pooler, Auth SSR, Storage de productos y comprobantes, Realtime de señales | Conectar proyecto de la marca y verificar acceso entre dos dispositivos |
| Mercado Pago Checkout Pro | Preferencia persistida por pedido, expiración, HMAC-SHA256 y consulta autenticada de pago | Credenciales y pruebas con comprador y vendedor de test del comercio |
| Resend | Plantillas HTML y texto, outbox y reintentos idempotentes | Dominio de envío verificado, destinatario de prueba autorizado y prueba de recepción |
| WhatsApp Cloud API | Preparación de respuestas, consentimiento, ventana de atención y transporte inyectable | Credenciales, autorización, templates de Meta y habilitación del canal en fase posterior |

## Mercado Pago
Configura la notificación de pagos en `/api/webhooks/mercadopago`. La firma incorpora `data.id` de la URL, `x-request-id` y `ts` de `x-signature`. El servidor comprueba con el proveedor el importe, la moneda, el comercio, el entorno y la referencia interna. La deduplicación usa el estado canónico y la fecha de actualización del proveedor. Los pagos tardíos pasan a revisión. Antes de producir un caso en revisión, concilia el dinero y la disponibilidad con Mercado Pago. La política de producción necesita una ventana operativa para atender estos casos. [Firma y notificaciones](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-orders/resources/notifications/webhooks) · [Vigencia de preferencia](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-preferences/additional-settings/term-of-preference)

## Resend
`RESEND_FROM` debe pertenecer al dominio verificado. El correo receptor operativo inicial es pabloyluca@proton.me, editable desde administración. Al confirmar un pago se insertan los avisos en la misma transacción. Un trabajador toma hasta diez eventos por pasada. Un error de transporte produce un reintento diferido. Los eventos llevan clave de deduplicación en PostgreSQL e Idempotency-Key en Resend. Las pasadas se ejecutan después de cambios operativos y mediante `/api/jobs` con Bearer `CRON_SECRET`. El cron diario solicita el resumen del día anterior en Cancún. Un error persistente queda registrado en `notification_events`. En el sandbox la entrega queda marcada como simulada u omitida. [Dominios de Resend](https://resend.com/docs/dashboard/domains/introduction) · [Idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys)

## LU y reutilización
El alcance de esta versión es preparar herramientas internas. LU puede consultar menú, cocina y zona, cotizar, crear una orden, obtener el enlace de pago y consultar el estado por token. La autoridad para confirmar dinero sigue en el adaptador del proveedor. `requestHumanSupport` registra un caso que un flujo humano puede atender.

El repositorio accesible de Danny incluye un webhook de WhatsApp y el módulo de Tony exporta `createTonyLeadHandoff`. Son puntos de referencia para el encaminamiento y la derivación a operador. La implementación local usa el contrato y los datos de esta pizzería. En el repositorio visible de LU se identificó una base de producto, sin un adaptador de comercio aplicable en las rutas revisadas. Para activar el canal faltan el número autorizado, el consentimiento registrado, un flujo de escalado atendido y templates aprobados para mensajes fuera de la ventana de servicio. [Referencia de plantillas de Meta](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-hsm/)
