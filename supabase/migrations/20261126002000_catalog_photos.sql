-- Preserve custom CMS uploads and the image URLs captured on historical orders.
create function pl_install_catalog_photos_v2() returns void
language sql security invoker set search_path=public,pg_temp as $$
  update products p set image='/media/catalogo-v2/' || ref.filename || '.webp'
  from (values
    ('00000000-0000-4000-8001-000000000001'::uuid, 'margherita', 'margherita'),
    ('00000000-0000-4000-8001-000000000002'::uuid, 'pepperoni', 'pepperoni'),
    ('00000000-0000-4000-8001-000000000003'::uuid, 'pepperoni-aceitunas', 'pepperoni-olivas'),
    ('00000000-0000-4000-8001-000000000004'::uuid, 'mediterranea', 'mediterranea'),
    ('00000000-0000-4000-8001-000000000005'::uuid, 'salmone', 'salmone'),
    ('00000000-0000-4000-8001-000000000006'::uuid, 'tonno', 'tonno'),
    ('00000000-0000-4000-8001-000000000007'::uuid, 'bosco-vegana', 'bosco-vegana')
  ) as ref(id, previous, filename)
  where p.id=ref.id and p.image='/media/' || ref.previous || '.webp'
$$;
revoke all on function pl_install_catalog_photos_v2() from public;
select pl_install_catalog_photos_v2();
