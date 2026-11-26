-- Catalog defaults and immutable line snapshots. Old orders retain their original totals.
alter table products add column slug text unique, add column category text not null default 'Pizzas artesanales',
  add column size_cm smallint not null default 30,
  add column cheese_mode text not null default 'none' check(cheese_mode in ('none','swap','native')),
  add column diet_class text not null default 'plant' check(diet_class in ('plant','option','vegan')),
  add column diet_verified boolean not null default false;
alter table ingredients add column cheese_role text unique check(cheese_role in ('base','vegan')),
  add column reference_price integer check(reference_price>=0);
alter table recipes add column cost_pending boolean not null default false;
alter table order_items add column cheese text check(cheese in ('swap','native')),
  add column cheese_supplement integer not null default 0 check(cheese_supplement>=0);

create function pl_line_recipe(pid uuid, omissions text[], swap boolean)
returns table(ingredient_id uuid, base_quantity numeric, category text)
language sql stable security invoker set search_path = public, pg_temp as $$
  select case when swap and i.cheese_role='base' then (select id from ingredients where cheese_role='vegan') else i.id end,
    ri.base_quantity,ri.category
  from recipe_items ri join ingredients i on i.id=ri.ingredient_id
  where ri.product_id=pid and not exists(select 1 from product_ingredient_labels l
    where l.product_id=pid and l.ingredient_id=i.id and l.label=any(omissions))
$$;
revoke all on function pl_line_recipe(uuid,text[],boolean) from public;

create function pl_install_vegan_v1() returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare
 bosco uuid='00000000-0000-4000-8001-000000000007';
 tonno uuid='00000000-0000-4000-8001-000000000006';
begin
 if not exists(select 1 from audit_logs where action='seed.v1') or exists(select 1 from audit_logs where action='seed.vegan.v1') then return; end if;
 update store_settings set value='{"veganSurcharge":1500}'::jsonb || value where singleton;
 update ingredients set cheese_role='base' where id='00000000-0000-4000-8002-000000000002';
 update ingredients set name='Atún Dolores Premium, corte grueso',purchase_unit='g',purchase_quantity=150,purchase_price=10200,unit_cost=68,presentation='150 g',reference_price=12900 where id='00000000-0000-4000-8002-000000000007';
 update ingredients set purchase_quantity=1,purchase_price=1000,unit_cost=1000,presentation='Caja kraft · 1 pieza' where id='00000000-0000-4000-8002-000000000009' and unit_cost is null;
 insert into ingredients(id,name,purchase_unit,unit,purchase_quantity,purchase_price,presentation,unit_cost,cheese_role) values
 ('00000000-0000-4000-8002-000000000010','Queso vegano GÜD','g','g',400,8000,'400 g',20,'vegan'),
 ('00000000-0000-4000-8002-000000000011','Masa de fermentación lenta','g','g',255,350,'Bola de 255 g',350.0/255,null),
 ('00000000-0000-4000-8002-000000000012','Salsa de tomate','g','g',70,400,'Porción estimada de 70 g',400.0/70,null),
 ('00000000-0000-4000-8002-000000000013','Champiñones','g','g',80,960,'Porción estimada de 80 g',12,null),
 ('00000000-0000-4000-8002-000000000014','Aceitunas negras','g','g',30,500,'Porción estimada de 30 g',500.0/30,null),
 ('00000000-0000-4000-8002-000000000015','Arúgula','g','g',15,400,'Porción estimada de 15 g',400.0/15,null),
 ('00000000-0000-4000-8002-000000000016','Tomates cherry','g','g',40,400,'Porción estimada de 40 g',10,null);
 insert into products(id,name,slug,description,price,image,ingredients,removable,available,position,cheese_mode,diet_class,diet_verified) values
 (bosco,'Bosco Vegana','bosco-vegana','Hongos frescos, aceitunas negras, queso vegano y arúgula fresca sobre nuestra masa de fermentación lenta, con salsa de tomate y aceite de oliva extra virgen.',18900,'/media/bosco-vegana.webp',
 array['Masa de fermentación lenta','Salsa de tomate','Queso vegano GÜD','Champiñones','Aceitunas negras','Arúgula','Aceite de oliva extra virgen'],array['Champiñones','Aceitunas negras','Arúgula'],true,7,'native','vegan',true);
 update products set cheese_mode='swap',diet_class=case when id in ('00000000-0000-4000-8001-000000000001','00000000-0000-4000-8001-000000000004') then 'option' else 'plant' end
 where id in ('00000000-0000-4000-8001-000000000001','00000000-0000-4000-8001-000000000002','00000000-0000-4000-8001-000000000003','00000000-0000-4000-8001-000000000004',tonno);
 update sales_channels set product_prices=jsonb_set(product_prices,array[bosco::text],'21900') where id in ('uber','didi','rappi');
 insert into recipes(product_id,complete,cost_pending) values(bosco,true,true);
 update recipes set complete=true,cost_pending=true where product_id=tonno;
 insert into recipe_items(product_id,ingredient_id,quantity,unit,base_quantity,category)
 select product,('00000000-0000-4000-8002-'||lpad(ing::text,12,'0'))::uuid,qty,u,qty,cat
 from (values (bosco,11,255,'g','masa'),(bosco,12,70,'g','salsa'),(bosco,10,130,'g','toppings'),
 (bosco,13,80,'g','toppings'),(bosco,14,30,'g','toppings'),(bosco,15,15,'g','toppings'),(bosco,5,30,'ml','toppings'),(bosco,9,1,'pz','empaque'),
 (tonno,11,255,'g','masa'),(tonno,7,50,'g','toppings'),(tonno,2,130,'g','toppings'),(tonno,5,30,'ml','toppings'),
 (tonno,15,15,'g','toppings'),(tonno,16,40,'g','toppings'),(tonno,9,1,'pz','empaque')) v(product,ing,qty,u,cat)
 on conflict(product_id,ingredient_id,category) do update set quantity=excluded.quantity,unit=excluded.unit,base_quantity=excluded.base_quantity;
 insert into product_ingredient_labels(product_id,ingredient_id,label)
 select p.id,i.id,t.label from products p cross join lateral unnest(p.ingredients)t(label)
 join ingredients i on lower(i.name)=lower(t.label) where p.id in (bosco,tonno) on conflict do nothing;
 insert into audit_logs(actor,action) values('migration','seed.vegan.v1');
end $$;
revoke all on function pl_install_vegan_v1() from public;
select pl_install_vegan_v1();
