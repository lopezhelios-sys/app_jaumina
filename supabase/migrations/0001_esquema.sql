-- =============================================================
-- Ja'umina · esquema base
-- Todo importe se guarda en guaraníes como bigint (sin decimales).
-- Todo id es uuid y puede venir generado por el cliente (uuid v7),
-- para que un pedido creado sin conexión ya tenga identidad definitiva.
-- =============================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ---------- tipos ----------
create type canal_pedido  as enum ('delivery','retiro','mesa');
create type estado_pedido as enum ('nuevo','cocina','listo','enviado','entregado','cancelado');
create type metodo_pago   as enum ('efectivo','transferencia','qr','tarjeta');
create type estado_pago   as enum ('pendiente','pagado','devuelto');
create type rol_usuario   as enum ('dueno','mostrador','cocina');
create type tipo_grupo    as enum ('unica','multiple');

-- =============================================================
-- LOCALES (tenant)
-- =============================================================
create table locales (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  nombre            text not null,
  claim             text,
  logo_url          text,
  -- marca: colores, tipografía y claim viven en datos, nunca en el código
  marca             jsonb not null default '{}'::jsonb,
  asistente_nombre  text not null default 'Asistente',

  moneda            text not null default 'PYG',
  zona_horaria      text not null default 'America/Asuncion',
  idioma            text not null default 'es',

  whatsapp          text,
  telefono          text,
  direccion         text,
  referencia        text,
  lat               numeric(10,7),
  lng               numeric(10,7),

  delivery_activo   boolean not null default true,
  retiro_activo     boolean not null default false,
  mesa_activo       boolean not null default false,

  envio             bigint  not null default 0,
  pedido_minimo     bigint  not null default 0,
  envio_gratis_desde bigint,
  demora_delivery   text    not null default '30-45 min',
  demora_retiro     text    not null default '15 min',
  radio_km          numeric(4,1),

  activo            boolean not null default true,
  creado_en         timestamptz not null default now()
);
comment on column locales.marca is 'Ej: {"primario":"#D93B22","oro":"#E8A93C","verde":"#2E4F2E","crema":"#FBF1DE"}';

-- horario por día (0 = domingo). Varias franjas por día son posibles.
create table horarios (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references locales(id) on delete cascade,
  dia_semana  smallint not null check (dia_semana between 0 and 6),
  abre        time not null,
  cierra      time not null
);
create index on horarios (local_id, dia_semana);

-- latido: el panel avisa al servidor que sigue vivo
create table local_estado (
  local_id       uuid primary key references locales(id) on delete cascade,
  ultimo_latido  timestamptz,
  abierto_manual boolean not null default true,
  pausa_motivo   text
);

-- usuarios del local (dueño, mostrador, cocina)
create table usuarios_local (
  user_id   uuid not null references auth.users(id) on delete cascade,
  local_id  uuid not null references locales(id) on delete cascade,
  rol       rol_usuario not null,
  nombre    text,
  creado_en timestamptz not null default now(),
  primary key (user_id, local_id)
);
create index on usuarios_local (local_id);

-- =============================================================
-- CATÁLOGO
-- =============================================================
create table categorias (
  id        uuid primary key default gen_random_uuid(),
  local_id  uuid not null references locales(id) on delete cascade,
  slug      text not null,
  nombre    text not null,
  icono     text,
  orden     smallint not null default 0,
  activa    boolean not null default true,
  unique (local_id, slug)
);
create index on categorias (local_id, orden);

create table productos (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null references locales(id) on delete cascade,
  categoria_id  uuid not null references categorias(id) on delete restrict,
  slug          text not null,
  nombre        text not null,
  -- descriptor: la muleta del nombre de fantasía ("tapas cargadas")
  descriptor    text,
  ingredientes  text[] not null default '{}',
  descripcion   text,
  porcion       text,
  precio        bigint not null check (precio >= 0),
  imagen_url    text,
  ilustracion   text,
  picante_base  smallint not null default 0 check (picante_base between 0 and 4),
  destacado     boolean not null default false,
  disponible    boolean not null default true,
  orden         smallint not null default 0,
  creado_en     timestamptz not null default now(),
  unique (local_id, slug)
);
create index on productos (local_id, categoria_id, orden);
create index on productos (local_id) where disponible;

-- Grupos de opciones reutilizables entre productos:
-- "Salsa a elección" (única, obligatoria) o "Adicionales" (múltiple).
create table grupos_opciones (
  id          uuid primary key default gen_random_uuid(),
  local_id    uuid not null references locales(id) on delete cascade,
  slug        text not null,
  nombre      text not null,
  ayuda       text,
  tipo        tipo_grupo not null default 'unica',
  min_selec   smallint not null default 0,
  max_selec   smallint,
  orden       smallint not null default 0,
  unique (local_id, slug)
);

create table opciones (
  id             uuid primary key default gen_random_uuid(),
  grupo_id       uuid not null references grupos_opciones(id) on delete cascade,
  local_id       uuid not null references locales(id) on delete cascade,
  nombre         text not null,
  descripcion    text,
  precio_delta   bigint not null default 0,
  nivel_picante  smallint check (nivel_picante between 0 and 4),
  disponible     boolean not null default true,
  por_defecto    boolean not null default false,
  orden          smallint not null default 0
);
create index on opciones (grupo_id, orden);

create table producto_grupos (
  producto_id uuid not null references productos(id) on delete cascade,
  grupo_id    uuid not null references grupos_opciones(id) on delete cascade,
  orden       smallint not null default 0,
  primary key (producto_id, grupo_id)
);

-- =============================================================
-- PEDIDOS
-- =============================================================
create table pedidos (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null references locales(id) on delete cascade,
  numero        integer,                     -- correlativo diario por local
  fecha         date not null default (now() at time zone 'America/Asuncion')::date,

  canal         canal_pedido not null,
  mesa          text,

  cliente       text not null,
  telefono      text,
  direccion     text,
  referencia    text,

  subtotal      bigint not null default 0,
  envio         bigint not null default 0,
  descuento     bigint not null default 0,
  total         bigint not null default 0,

  pago_metodo   metodo_pago not null default 'efectivo',
  pago_estado   estado_pago not null default 'pendiente',
  paga_con      bigint,

  nota          text,
  repartidor    text,

  estado        estado_pedido not null default 'nuevo',
  estado_en     timestamptz not null default now(),

  origen        text not null default 'app',  -- app | mostrador | whatsapp
  dispositivo   text,
  creado_en     timestamptz not null default now(),
  recibido_en   timestamptz not null default now(),

  unique (local_id, fecha, numero)
);
create index on pedidos (local_id, creado_en desc);
create index on pedidos (local_id, estado) where estado in ('nuevo','cocina','listo','enviado');

create table pedido_items (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references pedidos(id) on delete cascade,
  local_id      uuid not null references locales(id) on delete cascade,
  producto_id   uuid references productos(id) on delete set null,
  -- snapshot: el ticket no puede cambiar si mañana sube el precio
  nombre        text not null,
  descriptor    text,
  precio_unit   bigint not null,
  cantidad      smallint not null check (cantidad > 0),
  opciones      jsonb not null default '[]'::jsonb,
  quitados      text[] not null default '{}',
  nivel_picante smallint,
  nota          text,
  orden         smallint not null default 0
);
create index on pedido_items (pedido_id);

-- Bitácora inmutable. El estado del pedido es una proyección de esto.
-- El id lo genera el cliente, así un reintento de la cola no duplica nada.
create table pedido_eventos (
  id           uuid primary key,
  pedido_id    uuid not null references pedidos(id) on delete cascade,
  local_id     uuid not null references locales(id) on delete cascade,
  tipo         estado_pedido not null,
  actor        text,
  dispositivo  text,
  datos        jsonb not null default '{}'::jsonb,
  creado_en    timestamptz not null default now(),   -- hora del dispositivo
  recibido_en  timestamptz not null default now()    -- hora del servidor
);
create index on pedido_eventos (pedido_id, creado_en);
create index on pedido_eventos (local_id, recibido_en desc);

-- =============================================================
-- ENTREGAS: un link por pedido, sin login
-- =============================================================
create table entregas (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid not null references pedidos(id) on delete cascade,
  local_id    uuid not null references locales(id) on delete cascade,
  token       text not null unique,
  repartidor  text,
  asignado_en timestamptz not null default now(),
  llego_en    timestamptz,
  entregado_en timestamptz,
  expira_en   timestamptz not null default now() + interval '6 hours'
);
create index on entregas (pedido_id);

create table incidencias (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null references locales(id) on delete cascade,
  pedido_id  uuid references pedidos(id) on delete set null,
  origen     text not null,
  detalle    text not null,
  resuelta   boolean not null default false,
  creado_en  timestamptz not null default now()
);

-- =============================================================
-- NUMERACIÓN DIARIA POR LOCAL
-- =============================================================
create table numeracion (
  local_id uuid not null references locales(id) on delete cascade,
  fecha    date not null,
  ultimo   integer not null default 0,
  primary key (local_id, fecha)
);

create or replace function siguiente_numero(p_local uuid, p_fecha date)
returns integer language plpgsql as $$
declare n integer;
begin
  insert into numeracion (local_id, fecha, ultimo) values (p_local, p_fecha, 1)
  on conflict (local_id, fecha) do update set ultimo = numeracion.ultimo + 1
  returning ultimo into n;
  return n;
end $$;

-- =============================================================
-- PROYECCIÓN DEL ESTADO
-- Sin campo que dos dispositivos pisen: gana el evento más avanzado,
-- y 'cancelado' es terminal.
-- =============================================================
create or replace function rango_estado(e estado_pedido)
returns integer language sql immutable as $$
  select case e
    when 'nuevo' then 0 when 'cocina' then 1 when 'listo' then 2
    when 'enviado' then 3 when 'entregado' then 4 when 'cancelado' then 9 end;
$$;

create or replace function aplicar_evento()
returns trigger language plpgsql as $$
begin
  update pedidos
     set estado    = new.tipo,
         estado_en = new.creado_en
   where id = new.pedido_id
     and estado <> 'cancelado'
     and (new.tipo = 'cancelado' or rango_estado(new.tipo) > rango_estado(estado));
  return new;
end $$;

create trigger trg_aplicar_evento
after insert on pedido_eventos
for each row execute function aplicar_evento();

-- =============================================================
-- VISTA PÚBLICA DEL MENÚ
-- =============================================================
create or replace view menu_publico as
select p.local_id, l.slug as local_slug, c.slug as categoria, c.nombre as categoria_nombre,
       c.orden as categoria_orden, p.id, p.slug, p.nombre, p.descriptor, p.ingredientes,
       p.porcion, p.precio, p.imagen_url, p.ilustracion, p.picante_base, p.destacado, p.orden
from productos p
join categorias c on c.id = p.categoria_id
join locales l    on l.id = p.local_id
where p.disponible and c.activa and l.activo;
