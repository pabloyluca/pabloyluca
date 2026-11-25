# Decisiones de la primera versión
| Decisión | Motivo |
|---|---|
| Una aplicación Next.js y un único esquema PostgreSQL | La misma transacción puede verificar existencias, reserva, orden y efectos del pago |
| PGlite en sandbox, PostgreSQL de Supabase en el destino | Permite probar las migraciones, restricciones y consultas SQL reales sin crear recursos remotos |
| Centavos para precios, numeric para existencias y costos fraccionarios | Las compras por kilogramo o litro necesitan precisión que el precio final expresa en centavos |
| Cocina cerrada, entrega a domicilio desactivada y horno inicial de una plaza | Evita vender con cobertura o capacidad física sin confirmar. La recolección y el horno son configurables |
| Costos incompletos con margen pendiente | La referencia de mozzarella y pepperoni representa $28.28 MXN. Faltan masa, salsa, empaque y otros componentes para conocer la utilidad |
| Una reserva durante 15 minutos y producción solo con pago conciliado | Las aprobaciones tardías quedan visibles para intervención sin recuperar stock ya asignado |
| Una fila por pizza física | Tres pizzas idénticas pueden entrar al horno en tres instantes distintos y conservar sus tiempos |
| Un aviso transaccional por evento | El equipo puede seguir cocinando si falla el correo |
| Fotografías de los propios mockups y letras del logotipo original | Conserva la identidad y permite reemplazar fotos desde el CMS; Zaslia quedó pendiente de licencia |
| El rol KITCHEN ve pedidos y producción | El pie financiero del mockup se reserva a las vistas autorizadas |
| Fotos y comprobantes en buckets distintos | El menú se puede consultar sin autenticar y los comprobantes solo se abren con acceso administrativo |
| LU sin número activo | El proveedor, el consentimiento y el proceso humano podrán validarse después del comercio principal |
