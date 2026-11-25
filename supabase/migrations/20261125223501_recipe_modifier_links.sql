create table product_ingredient_labels(
  product_id uuid not null references products,
  ingredient_id uuid not null references ingredients,
  label text not null,
  primary key(product_id,ingredient_id,label)
);
alter table product_ingredient_labels enable row level security;
do $$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all privileges on product_ingredient_labels from anon,authenticated;
  end if;
end $$;
