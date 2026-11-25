# Pablo & Luca
Tienda de pizza artesanal y operación de cocina para Huayacán, Cancún. El cliente compra como invitado. El equipo recibe el pedido pagado en cocina, hornea las unidades por separado y sigue el inventario y la rentabilidad desde administración.

## Abrir el sandbox
Requiere Node 22.13 o posterior. El entorno probado usa Node 24. Desde este repositorio ejecuta lo siguiente.

```sh
npm ci
npm run sandbox:setup
npm run dev -- --port 3217
```

| Pantalla | Dirección |
|---|---|
| Tienda | [Abrir tienda](http://127.0.0.1:3217) |
| Administración | [Pulso del Negocio](http://127.0.0.1:3217/admin) |
| Cocina de pantalla completa | [Abrir KDS](http://127.0.0.1:3217/kitchen) |

El primer arranque genera contraseñas locales aleatorias para el dueño y cocina en `.env.local`. Inicia sesión con los campos `SANDBOX_OWNER_*` o `SANDBOX_KITCHEN_*`. La cocina empieza cerrada. Abre el interruptor en el overview para realizar tu primer pedido de prueba. La recolección está habilitada y la entrega queda pendiente de configurar zonas. El botón de pago de prueba confirma el pedido en el servidor local.

El sandbox guarda sus datos en `.sandbox/`. Usa un solo servidor por directorio de datos. En Vercel se exige Supabase. Un pedido del sandbox, los inventarios de ejemplo y las contraseñas de prueba pertenecen exclusivamente al entorno local.

## Verificación
```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Las pruebas E2E levantan su propio servidor de producción local en el puerto 3218 y utilizan una base temporal. Usan Chrome instalado en macOS. En otros entornos instala Chromium mediante `npx playwright install chromium`, o configura `PLAYWRIGHT_CHANNEL` con el navegador disponible.

## Entrega
- [Guía de despliegue y activación](docs/DEPLOYMENT.md)
- [Estado por fase](docs/ROADMAP.md)
- [Pruebas y evidencia visual](docs/QA.md)
- [Modelo de datos](docs/DATABASE.md)
- [Arquitectura](docs/ARCHITECTURE.md), [integraciones](docs/INTEGRATIONS.md), [decisiones](docs/DECISIONS.md) y [fuentes de diseño](docs/SOT.md)
