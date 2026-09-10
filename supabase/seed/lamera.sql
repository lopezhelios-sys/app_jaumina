-- =============================================================
-- Ja'umina · semilla del primer local: La Mera
-- Los precios marcados PROVISORIO se cambian con un update de una línea.
-- =============================================================
begin;

insert into locales (id, slug, nombre, claim, asistente_nombre, marca,
                     whatsapp, direccion, delivery_activo, retiro_activo, mesa_activo,
                     envio, pedido_minimo, demora_delivery)
values (
  '11111111-1111-4111-8111-111111111111',
  'lamera',
  'La Mera',
  'Sabor que te hace volver',
  'Merita',
  '{"primario":"#D93B22","oro":"#E8A93C","verde":"#2E4F2E","crema":"#FBF1DE","fondo":"#171009"}'::jsonb,
  null,                       -- PENDIENTE: número de WhatsApp
  'Santa Rita, Alto Paraná',  -- PENDIENTE: dirección exacta
  true, false, false,
  15000, 30000, '30-45 min'
);

-- jueves(4), viernes(5), sábado(6) de 18:00 a 23:00
insert into horarios (local_id, dia_semana, abre, cierra) values
  ('11111111-1111-4111-8111-111111111111', 4, '18:00', '23:00'),
  ('11111111-1111-4111-8111-111111111111', 5, '18:00', '23:00'),
  ('11111111-1111-4111-8111-111111111111', 6, '18:00', '23:00');

insert into local_estado (local_id, abierto_manual)
values ('11111111-1111-4111-8111-111111111111', true);

-- ---------- categorías ----------
insert into categorias (id, local_id, slug, nombre, icono, orden) values
  ('22222222-0001-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','tapas','Tapas','🥔',1),
  ('22222222-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','mexicanas','Mexicanas','🌮',2),
  ('22222222-0003-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','bebidas','Bebidas','🥤',3);

-- ---------- grupos de opciones ----------
insert into grupos_opciones (id, local_id, slug, nombre, ayuda, tipo, min_selec, max_selec, orden) values
  ('33333333-0001-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','salsa','Elegí tu salsa','Todas se sirven aparte',        'unica',    1, 1, 1),
  ('33333333-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','adicionales','Sumale algo','Se agrega sobre la porción','multiple', 0, 5, 2),
  ('33333333-0003-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','sabor-jugo','Sabor del jugo',null,                       'unica',    1, 1, 1),
  ('33333333-0004-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','tamano-jugo','Tamaño',null,                              'unica',    1, 1, 2),
  ('33333333-0005-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','sabor-refresco','Sabor del refresco',null,               'unica',    1, 1, 1);

insert into opciones (grupo_id, local_id, nombre, precio_delta, nivel_picante, por_defecto, orden) values
  -- salsas: PENDIENTE confirmar los tipos exactos
  ('33333333-0001-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Suave',  0, 1, true,  1),
  ('33333333-0001-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Fuerte', 0, 3, false, 2),
  -- adicionales
  ('33333333-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Queso cheddar',      5000, null, false, 1),
  ('33333333-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Carne desmenuzada',  5000, null, false, 2),
  ('33333333-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Guacamole',          5000, null, false, 3),
  ('33333333-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Panceta',            5000, null, false, 4),
  ('33333333-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Pico de gallo',      5000, null, false, 5),
  -- jugos
  ('33333333-0003-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Manzana', 0, null, true,  1),
  ('33333333-0003-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Naranja', 0, null, false, 2),
  ('33333333-0003-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Durazno', 0, null, false, 3),
  ('33333333-0004-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','200 ml',      0, null, true,  1),
  ('33333333-0004-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','1 litro', 10000, null, false, 2),  -- PROVISORIO
  -- refrescos
  ('33333333-0005-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Coca-Cola',      0, null, true,  1),
  ('33333333-0005-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Fanta naranja',  0, null, false, 2),
  ('33333333-0005-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Sprite',         0, null, false, 3),
  ('33333333-0005-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','Fanta guaraná',  0, null, false, 4);

-- ---------- carta ----------
-- Todos los platos a 25.000 (PROVISORIO). Porción: 4 unidades.
insert into productos (id, local_id, categoria_id, slug, nombre, descriptor, ingredientes,
                       porcion, precio, ilustracion, picante_base, destacado, orden) values

('44444444-0001-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0001-4111-8111-111111111111',
 'el-bandido','El Bandido','Tapas cargadas',
 array['queso cheddar','papas','salsa de la casa'],
 'Una porción · 4 unidades', 25000, '🧀', 1, false, 1),

('44444444-0002-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0001-4111-8111-111111111111',
 'el-charro','El Charro','Tapa con carne',
 array['carne desmenuzada','papas','queso cheddar','panceta','salsa de la casa'],
 'Una porción · 4 unidades', 25000, '🥩', 1, true, 2),

('44444444-0003-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0001-4111-8111-111111111111',
 'el-vaquero','El Vaquero','Tapa mexicana',
 array['carne desmenuzada','guacamole','queso mozzarella','pico de gallo'],
 'Una porción · 4 unidades', 25000, '🌶️', 2, false, 3),

('44444444-0004-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0002-4111-8111-111111111111',
 'el-compadre','El Compadre','Nachos tradicionales',
 array['totopos','queso mozzarella','salsa mexicana'],
 'Una porción', 25000, '🧀', 1, false, 1),

('44444444-0005-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0002-4111-8111-111111111111',
 'el-patron','El Patrón','Nachos supreme',
 array['carne desmenuzada','queso mozzarella','guacamole','salsa mexicana','salsa especial de la casa','pico de gallo'],
 'Una porción', 25000, '🧀', 2, true, 2),

('44444444-0006-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0002-4111-8111-111111111111',
 'la-mera','La Mera','Torrezno mexicano',
 array['torrezno','guacamole','salsa a elección'],
 'Una porción', 25000, '🥓', 2, true, 3),

('44444444-0007-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0002-4111-8111-111111111111',
 'el-burrito-del-barrio','El burrito del barrio','Tortillas mexicanas',
 array['tortilla','carne desmenuzada','guacamole','queso mozzarella','salsa mexicana'],
 'Una porción', 25000, '🌯', 2, false, 4),

-- bebidas: PRECIOS PROVISORIOS
('44444444-0008-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0003-4111-8111-111111111111',
 'jugo','Jugo natural','Manzana, naranja o durazno',
 array[]::text[], null, 10000, '🧃', 0, false, 1),

('44444444-0009-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','22222222-0003-4111-8111-111111111111',
 'refresco','Refresco 500 ml','Línea Coca-Cola',
 array[]::text[], null, 10000, '🥤', 0, false, 2);

-- ---------- qué opciones tiene cada producto ----------
-- salsa: solo donde el local la ofrece a elección
insert into producto_grupos (producto_id, grupo_id, orden) values
  ('44444444-0006-4111-8111-111111111111','33333333-0001-4111-8111-111111111111',1);

-- adicionales: en todos los platos, en ninguna bebida
insert into producto_grupos (producto_id, grupo_id, orden)
select id, '33333333-0002-4111-8111-111111111111', 2
  from productos
 where local_id = '11111111-1111-4111-8111-111111111111'
   and categoria_id <> '22222222-0003-4111-8111-111111111111';

-- bebidas
insert into producto_grupos (producto_id, grupo_id, orden) values
  ('44444444-0008-4111-8111-111111111111','33333333-0003-4111-8111-111111111111',1),
  ('44444444-0008-4111-8111-111111111111','33333333-0004-4111-8111-111111111111',2),
  ('44444444-0009-4111-8111-111111111111','33333333-0005-4111-8111-111111111111',1);

commit;

-- =============================================================
-- PENDIENTES (todo lo de abajo es un update de una línea)
--   update locales set whatsapp = '5959...', direccion = '...' where slug = 'lamera';
--   update productos set precio = X where slug = '...' and local_id = '1111...';
--   update opciones set precio_delta = X where nombre = '1 litro';
-- =============================================================
