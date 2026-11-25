alter table public.sales_channels
  add column presentation jsonb not null default '{}'::jsonb check (jsonb_typeof(presentation) = 'object'),
  add column product_prices jsonb not null default '{}'::jsonb check (jsonb_typeof(product_prices) = 'object');
