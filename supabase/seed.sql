do $seed$ begin
lock table store_settings in share row exclusive mode;
if exists(select 1 from audit_logs where action='seed.v1') then return; end if;
insert into store_settings (singleton,value) values
(true,'{"open": false, "pickup": true, "delivery": false, "ovenMinutes": 9, "ovenCapacity": 1, "temperature": 250, "maxActiveUnits": 12, "limitDough": true, "homeTitle": "Pizza artesanal como en Italia", "homeDescription": "Masa de fermentación lenta, ingredientes reales y el sabor que se comparte.", "banner": "", "hours": "", "businessName": "Pablo & Luca", "notificationEmail": "pabloyluca@proton.me", "notifications": {}}'::jsonb)
on conflict do nothing;
insert into store_signals (topic) values
('public'),
('staff'),
('kitchen')
on conflict do nothing;
insert into ovens (id,name,capacity,temperature,seconds) values
('primary','Koblenz',1,250,540)
on conflict do nothing;
insert into sales_channels (id,name,commission) values
('store','Tienda propia',null),
('whatsapp','WhatsApp',null),
('uber','Uber Eats',30),
('rappi','Rappi',30),
('didi','DiDi Food',30),
('other','Otros',null)
on conflict do nothing;
insert into products (id,name,description,price,image,ingredients,removable,available,position) values
('00000000-0000-4000-8001-000000000001','Margherita','Tomate, mozzarella, albahaca fresca y aceite de oliva extra virgen.',14900,'/media/margherita.webp',ARRAY['Tomate','Mozzarella','Albahaca fresca','Aceite de oliva extra virgen']::text[],ARRAY['Tomate','Mozzarella','Albahaca fresca','Aceite de oliva extra virgen']::text[],true,1),
('00000000-0000-4000-8001-000000000002','Pepperoni','Tomate, mozzarella y pepperoni.',14900,'/media/pepperoni.webp',ARRAY['Tomate','Mozzarella','Pepperoni']::text[],ARRAY['Tomate','Mozzarella','Pepperoni']::text[],true,2),
('00000000-0000-4000-8001-000000000003','Pepperoni & Aceitunas','Tomate, mozzarella, pepperoni y aceitunas negras.',15900,'/media/pepperoni-aceitunas.webp',ARRAY['Tomate','Mozzarella','Pepperoni','Aceitunas negras']::text[],ARRAY['Tomate','Mozzarella','Pepperoni','Aceitunas negras']::text[],true,3),
('00000000-0000-4000-8001-000000000004','Mediterránea','Mozzarella, aceitunas negras, alcachofa, tomate cherry y orégano.',20900,'/media/mediterranea.webp',ARRAY['Mozzarella','Aceitunas negras','Alcachofa','Tomate cherry','Orégano']::text[],ARRAY['Mozzarella','Aceitunas negras','Alcachofa','Tomate cherry','Orégano']::text[],true,4),
('00000000-0000-4000-8001-000000000005','Salmone','Salmón, arúgula, queso cremoso y ralladura de limón.',25900,'/media/salmone.webp',ARRAY['Salmón','Arúgula','Queso cremoso','Ralladura de limón']::text[],ARRAY['Salmón','Arúgula','Queso cremoso','Ralladura de limón']::text[],true,5),
('00000000-0000-4000-8001-000000000006','Tonno','Atún en lajas, mozzarella, arúgula, tomates cherry y aceite de oliva.',19900,'/media/tonno.webp',ARRAY['Atún en lajas','Mozzarella','Arúgula','Tomates cherry','Aceite de oliva']::text[],ARRAY['Atún en lajas','Mozzarella','Arúgula','Tomates cherry','Aceite de oliva']::text[],true,6)
on conflict do nothing;
insert into ingredients (id,name,purchase_unit,unit,purchase_quantity,purchase_price,presentation,unit_cost) values
('00000000-0000-4000-8002-000000000001','Harina Selecta','kg','g',10,19948,'10 kg',1.9948),
('00000000-0000-4000-8002-000000000002','Mozzarella','kg','g',2.2,33000,'2.2 kg',15.0),
('00000000-0000-4000-8002-000000000003','Pepperoni','kg','g',2.26,39700,'2.26 kg',17.56637168141593),
('00000000-0000-4000-8002-000000000004','Queso Philadelphia','g','g',800,15800,'800 g',19.75),
('00000000-0000-4000-8002-000000000005','Aceite de oliva extra virgen','L','ml',2,30500,'2 L',15.25),
('00000000-0000-4000-8002-000000000006','Salmón','g','g',400,50000,'400 g',125.0),
('00000000-0000-4000-8002-000000000007','Atún fresco','kg','g',1,39900,'1 kg',39.9),
('00000000-0000-4000-8002-000000000008','Salsa','ml','ml',0,0,'',null),
('00000000-0000-4000-8002-000000000009','Cajas','pz','pz',0,0,'',null)
on conflict do nothing;
insert into recipes (product_id,complete) values
('00000000-0000-4000-8001-000000000001',false),
('00000000-0000-4000-8001-000000000002',false),
('00000000-0000-4000-8001-000000000003',false),
('00000000-0000-4000-8001-000000000004',false),
('00000000-0000-4000-8001-000000000005',false),
('00000000-0000-4000-8001-000000000006',false)
on conflict do nothing;
insert into recipe_items (product_id,ingredient_id,quantity,unit,base_quantity,category) values
('00000000-0000-4000-8001-000000000001','00000000-0000-4000-8002-000000000002',130,'g',130,'toppings'),
('00000000-0000-4000-8001-000000000002','00000000-0000-4000-8002-000000000002',130,'g',130,'toppings'),
('00000000-0000-4000-8001-000000000003','00000000-0000-4000-8002-000000000002',130,'g',130,'toppings'),
('00000000-0000-4000-8001-000000000004','00000000-0000-4000-8002-000000000002',130,'g',130,'toppings'),
('00000000-0000-4000-8001-000000000006','00000000-0000-4000-8002-000000000002',130,'g',130,'toppings'),
('00000000-0000-4000-8001-000000000002','00000000-0000-4000-8002-000000000003',50,'g',50,'toppings'),
('00000000-0000-4000-8001-000000000003','00000000-0000-4000-8002-000000000003',50,'g',50,'toppings'),
('00000000-0000-4000-8001-000000000001','00000000-0000-4000-8002-000000000005',1,'fl_oz',29.5735,'toppings'),
('00000000-0000-4000-8001-000000000006','00000000-0000-4000-8002-000000000005',1,'fl_oz',29.5735,'toppings')
on conflict do nothing;
insert into product_ingredient_labels(product_id,ingredient_id,label)
select p.id,i.id,lbl.label from products p cross join lateral unnest(p.ingredients) lbl(label)
join ingredients i on lower(i.name)=lower(lbl.label) or
  (i.name='Aceite de oliva extra virgen' and lbl.label='Aceite de oliva') or
  (i.name='Atún fresco' and lbl.label='Atún en lajas') or
  (i.name='Queso Philadelphia' and lbl.label='Queso cremoso')
on conflict do nothing;
insert into audit_logs(actor,action) values('migration','seed.v1');
perform pl_install_vegan_v1();
perform pl_install_catalog_photos_v2();
end $seed$;
