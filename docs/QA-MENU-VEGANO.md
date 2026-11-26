# Menú vegano y fotografía de catálogo

Revisión local del 25 de noviembre de 2026. La cocina de revisión queda cerrada. El equipo confirmó los insumos de Bosco para mostrar la etiqueta VEGANA.

## Pruebas ejecutadas

| Área | Resultado observado |
| --- | --- |
| Compilación | Next.js completó la compilación optimizada y la comprobación de TypeScript. |
| Dominio e integraciones | 16 pruebas aprobadas, con PostgreSQL local aislado. Se probaron promoción, faltantes, reservas, consumo, snapshots, permisos y actualización del costo de adquisición. |
| Navegador | 8 pruebas Playwright aprobadas en Chrome. Se probaron también las seis referencias anteriores, el ERP, el CMS y la gestión del horno. |
| Fotos | Siete maestros independientes de 1536 × 1024. Siete WebP de 840 × 560. Las siete cargas autenticadas en el CMS devolvieron archivos idénticos a los WebP por comparación de bytes. |
| Storefront | Se inspeccionaron capturas de página completa a 1440 y 390 px. El menú tiene siete productos, los bordes de las pizzas se ven enteros y no hay desbordamiento horizontal. También pasó la prueba de navegación a 320 px. |
| Administración | El CMS guardó la imagen de cada producto y un cambio de precio de Bosco. El menú reflejó el precio publicado. El precio de prueba se restauró. Se comprobó el editor de gramajes y los permisos de Admin y KDS. |
| Carrito y cocina | Dos Margheritas con quesos distintos sobrevivieron a la recarga como líneas separadas. El pago simulado por $502 llegó a una sesión de cocina independiente con tres unidades y las dos indicaciones de queso correctas. Las pruebas verificaron que cada cronómetro conserve su vencimiento al recargar y que extender uno afecte solo a esa unidad. |
| Inventario e historial | La compra consumió 130 g de mozzarella y 260 g de queso GÜD. Agotar el GÜD deshabilitó Bosco y la sustitución, conservando la Margherita tradicional. Un cambio posterior en el suplemento preservó los importes del pedido anterior. |
| Precios por canal | Bosco quedó en $189 directos y $219 para las tres plataformas. Con el costo estimado de $66.68, la contribución bruta es $122.32 directa y $86.62 con comisión de 30 %. El cálculo excluye envío. |
| Sustitución | Una porción de 130 g cuesta $19.50 de mozzarella o $26 de GÜD. El suplemento de $15 deja una contribución incremental de $8.50 directa y $4 con comisión de 30 %. Bosco lleva su queso incluido. |
| Tonno | Cambiar el atún de $102 a $129 por 150 g elevó el costo de la porción de $34 a $43 y el costo preliminar total de $79.58 a $88.58. El precio comercial permaneció en $199. |

La prueba entre cliente y cocina utilizó sesiones de navegador aisladas en la misma máquina. Las resoluciones móviles se probaron por emulación. La aprobación de esta revisión queda pendiente antes de cualquier despliegue.

## Decisiones que requieren revisión del equipo

- La Margherita comercial se generó con la Bosco aprobada y la descripción de la masa. Falta contrastarla con la fotografía de la Margherita real, que no acompañaba al texto recibido.
- Para mostrar la pizza entera, se amplió el encuadre de la Bosco aprobada. El original se conserva.
- El CMS mantiene el nombre comercial anterior «Pepperoni & Aceitunas». Su nueva imagen se llama `pepperoni-olivas.webp`.
- Salmone conserva queso cremoso, sin sustitución ni etiqueta de ausencia de lactosa. Margherita y Mediterránea admiten la sustitución y el CMS permite validar la declaración alimentaria por producto.
- Los costos de Bosco y Tonno están marcados como estimaciones. Para conciliar el total preliminar de Tonno se estimaron 40 g de tomate cherry en $4, ingrediente de su ficha comercial previa. La dirección fotográfica pidió salsa de tomate. Conviene cotejar ficha, foto y gramaje con cocina.
- La instancia de revisión usa inventario ficticio local y conserva los pedidos históricos del sandbox anterior en su base original.

## Archivos y conservación

- Las migraciones `20261126001000_vegan_menu.sql` y `20261126002000_catalog_photos.sql` separan la lógica alimentaria de la actualización de fotografías. El seed usa las mismas funciones en instalaciones nuevas. Las imágenes anteriores siguen accesibles en sus rutas para los pedidos históricos. Una foto personalizada que ya se hubiera subido por el CMS conserva su asociación durante la migración.
- `lib/domain`, `lib/contracts.ts`, `lib/db` y `lib/lu/tools.ts` incorporan los gramajes efectivos, el suplemento y los precios registrados por unidad. `lib/preview/catalog.json` contiene la referencia visual estática. El CMS del sandbox operativo lee y escribe en su propia base.
- `components/store`, `components/ops` y `styles` contienen el selector de queso, el resumen de checkout, la configuración del CMS, la contribución bruta por canal y las indicaciones de cocina.
- `public/media/catalogo-v2` contiene los siete WebP. Los maestros, el respaldo anterior, la lámina comparativa y las capturas se entregan en la carpeta Fotografia de esta revisión.
- `tests/vegan-menu.test.ts` y `tests/vegan-store.spec.ts` cubren el nuevo flujo. `tests/domain-commerce.test.ts` incorpora el séptimo producto. Para repetir la suite, ejecutar `npm test`, `npm run build` en modo sandbox y `npm run test:e2e` con las credenciales locales de pruebas.
