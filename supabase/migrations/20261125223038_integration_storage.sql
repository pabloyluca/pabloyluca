create table public.payment_preferences (
  order_id uuid primary key references public.orders(id),
  provider_id text not null unique,
  checkout_url text not null,
  created_at timestamptz not null default now()
);
create table public.support_requests (
  id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id),
  contact text not null, reason text not null, created_at timestamptz not null default now()
);
alter table public.payment_preferences enable row level security;
alter table public.support_requests enable row level security;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then
   revoke all on public.payment_preferences,public.support_requests from anon,authenticated;
 end if;
 if to_regclass('storage.buckets') is not null then
   insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
   ('pl-products','pl-products',true,4194304,array['image/webp','image/png','image/jpeg']),
   ('pl-receipts','pl-receipts',false,4194304,array['image/webp','image/png','image/jpeg','application/pdf'])
   on conflict(id) do nothing;
 end if;
end $$;
