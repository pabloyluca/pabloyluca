-- Only advance the bundled catalog photo. Historical lines and CMS uploads keep their URLs.
update products
set image = '/media/catalogo-v3/margherita.webp'
where id = '00000000-0000-4000-8001-000000000001'
  and image = '/media/catalogo-v2/margherita.webp';
