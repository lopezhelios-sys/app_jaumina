-- =============================================================
-- Ja'umina · seguridad y funciones
-- Regla: el cliente nunca escribe precios ni totales. Los calcula el servidor.
-- =============================================================

-- ---------- helpers ----------
create or replace function mis_locales()
returns setof uuid language sql stable security definer set search_path = public as $$
  select local_id from usuarios_local where user_id = auth.uid();
$$;

create or replace function tiene_rol(p_local uuid, p_roles rol_usuario[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuarios_local
     where user_id = auth.uid() and local_id = p_local and rol = any(p_roles)
  );
$$;

-- ---------- activar RLS ----------
alter table locales          enable row level security;
alter table horarios         enable row level security;
alter table local_estado     enable row level security;
alter table usuarios_local   enable row level security;
alter table categorias       enable row level security;
alter table productos        enable row level security;
alter table grupos_opciones  enable row level security;
alter table opciones         enable row level security;
alter table producto_grupos  enable row level security;
alter table pedidos          enable row level security;
alter table pedido_items     enable row level security;
alter table pedido_eventos   enable row level security;
alter table entregas         enable row level security;
alter table incidencias      enable row level security;
alter table numeracion       enable row level security;

-- ---------- catálogo: lectura pública, escritura del dueño ----------
create policy leer_locales on locales for select using (activo);
create policy leer_horarios on horarios for select using (true);
create policy leer_estado_local on local_estado for select using (true);
create policy leer_categorias on categorias for select using (activa);
create policy leer_productos on productos for select using (true);
create policy leer_grupos on grupos_opciones for select using (true);
create policy leer_opciones on opciones for select using (true);
create policy leer_producto_grupos on producto_grupos for select using (true);

create policy dueno_edita_local on locales for update
  using (tiene_rol(id, array['dueno']::rol_usuario[]));

create policy dueno_gestiona_categorias on categorias for all
  using (tiene_rol(local_id, array['dueno']::rol_usuario[]))
  with check (tiene_rol(local_id, array['dueno']::rol_usuario[]));

-- el dueño edita todo; mostrador solo puede prender y apagar disponibilidad
create policy dueno_gestiona_productos on productos for all
  using (tiene_rol(local_id, array['dueno']::rol_usuario[]))
  with check (tiene_rol(local_id, array['dueno']::rol_usuario[]));

create policy mostrador_marca_agotado on productos for update
  using (tiene_rol(local_id, array['mostrador','cocina']::rol_usuario[]))
  with check (tiene_rol(local_id, array['mostrador','cocina']::rol_usuario[]));

create policy dueno_gestiona_grupos on grupos_opciones for all
  using (tiene_rol(local_id, array['dueno']::rol_usuario[]))
  with check (tiene_rol(local_id, array['dueno']::rol_usuario[]));

create policy dueno_gestiona_opciones on opciones for all
  using (tiene_rol(local_id, array['dueno']::rol_usuario[]))
  with check (tiene_rol(local_id, array['dueno']::rol_usuario[]));

create policy dueno_gestiona_horarios on horarios for all
  using (tiene_rol(local_id, array['dueno']::rol_usuario[]))
  with check (tiene_rol(local_id, array['dueno']::rol_usuario[]));

create policy panel_actualiza_latido on local_estado for all
  using (local_id in (select mis_locales()))
  with check (local_id in (select mis_locales()));

create policy ver_companeros on usuarios_local for select
  using (local_id in (select mis_locales()));

-- ---------- pedidos: solo el equipo del local ----------
create policy equipo_ve_pedidos on pedidos for select
  using (local_id in (select mis_locales()));

create policy equipo_edita_pedidos on pedidos for update
  using (tiene_rol(local_id, array['dueno','mostrador']::rol_usuario[]))
  with check (tiene_rol(local_id, array['dueno','mostrador']::rol_usuario[]));

create policy equipo_crea_pedidos on pedidos for insert
  with check (local_id in (select mis_locales()));

create policy equipo_ve_items on pedido_items for select
  using (local_id in (select mis_locales()));
create policy equipo_crea_items on pedido_items for insert
  with check (local_id in (select mis_locales()));

-- los eventos solo se agregan, nunca se editan ni se borran
create policy equipo_ve_eventos on pedido_eventos for select
  using (local_id in (select mis_locales()));
create policy equipo_agrega_eventos on pedido_eventos for insert
  with check (local_id in (select mis_locales()));

create policy equipo_ve_entregas on entregas for select
  using (local_id in (select mis_locales()));
create policy equipo_gestiona_entregas on entregas for all
  using (tiene_rol(local_id, array['dueno','mostrador']::rol_usuario[]))
  with check (tiene_rol(local_id, array['dueno','mostrador']::rol_usuario[]));

create policy equipo_ve_incidencias on incidencias for select
  using (local_id in (select mis_locales()));
create policy equipo_crea_incidencias on incidencias for insert
  with check (local_id in (select mis_locales()));

create policy equipo_ve_numeracion on numeracion for select
  using (local_id in (select mis_locales()));

-- =============================================================
-- ¿El local está tomando pedidos ahora?
-- =============================================================
create or replace function local_disponible(p_local uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l locales; e local_estado; ahora timestamptz; hoy_abre boolean; latido_min numeric;
begin
  select * into l from locales where id = p_local;
  if not found or not l.activo then
    return jsonb_build_object('abierto', false, 'motivo', 'inactivo');
  end if;
  select * into e from local_estado where local_id = p_local;
  ahora := now() at time zone l.zona_horaria;

  select exists (
    select 1 from horarios h
     where h.local_id = p_local
       and h.dia_semana = extract(dow from ahora)::smallint
       and ahora::time between h.abre and h.cierra
  ) into hoy_abre;

  latido_min := extract(epoch from (now() - coalesce(e.ultimo_latido, 'epoch'::timestamptz))) / 60;

  return jsonb_build_object(
    'abierto',        hoy_abre and coalesce(e.abierto_manual, true) and latido_min < 15,
    'en_horario',     hoy_abre,
    'abierto_manual', coalesce(e.abierto_manual, true),
    'latido_min',     round(latido_min),
    -- con el latido caído el menú sigue, pero el cliente recibe el aviso honesto
    'conexion',       case when latido_min < 2 then 'ok'
                           when latido_min < 15 then 'inestable'
                           else 'caido' end
  );
end $$;

-- =============================================================
-- CREAR PEDIDO (lo llama el menú público, sin sesión)
-- items: [{"producto_id":"...","cantidad":2,"opciones":["uuid"],"quitados":["pico de gallo"],"nota":""}]
-- =============================================================
create or replace function crear_pedido(
  p_id          uuid,          -- generado en el cliente: reintentar no duplica
  p_local_slug  text,
  p_canal       canal_pedido,
  p_cliente     text,
  p_telefono    text,
  p_direccion   text,
  p_referencia  text,
  p_pago        metodo_pago,
  p_paga_con    bigint,
  p_nota        text,
  p_items       jsonb,
  p_mesa        text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l          locales;
  it         jsonb;
  prod       productos;
  op         opciones;
  op_id      uuid;
  delta      bigint;
  picante    smallint;
  ops_snap   jsonb;
  v_subtotal bigint := 0;
  v_envio    bigint := 0;
  n          integer;
  fecha_hoy  date;
begin
  select * into l from locales where slug = p_local_slug and activo;
  if not found then raise exception 'local_no_encontrado'; end if;

  if exists (select 1 from pedidos where id = p_id) then
    return jsonb_build_object('id', p_id, 'duplicado', true);
  end if;

  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'pedido_vacio';
  end if;

  fecha_hoy := (now() at time zone l.zona_horaria)::date;
  n := siguiente_numero(l.id, fecha_hoy);

  insert into pedidos (id, local_id, numero, fecha, canal, mesa, cliente, telefono,
                       direccion, referencia, pago_metodo, paga_con, nota, origen)
  values (p_id, l.id, n, fecha_hoy, p_canal, p_mesa, p_cliente, p_telefono,
          p_direccion, p_referencia, p_pago, p_paga_con, p_nota, 'app');

  for it in select * from jsonb_array_elements(p_items) loop
    select * into prod from productos
     where id = (it->>'producto_id')::uuid and local_id = l.id and disponible;
    if not found then raise exception 'producto_no_disponible: %', it->>'producto_id'; end if;

    delta := 0; ops_snap := '[]'::jsonb; picante := prod.picante_base;

    for op_id in select (jsonb_array_elements_text(coalesce(it->'opciones','[]'::jsonb)))::uuid loop
      select * into op from opciones where id = op_id and local_id = l.id and disponible;
      if not found then raise exception 'opcion_no_disponible: %', op_id; end if;
      delta := delta + op.precio_delta;
      if op.nivel_picante is not null then picante := op.nivel_picante; end if;
      ops_snap := ops_snap || jsonb_build_object('id', op.id, 'nombre', op.nombre, 'delta', op.precio_delta);
    end loop;

    insert into pedido_items (pedido_id, local_id, producto_id, nombre, descriptor,
                              precio_unit, cantidad, opciones, quitados, nivel_picante, nota)
    values (p_id, l.id, prod.id, prod.nombre, prod.descriptor,
            prod.precio + delta, (it->>'cantidad')::smallint, ops_snap,
            coalesce(array(select jsonb_array_elements_text(it->'quitados')), '{}'),
            picante, it->>'nota');

    v_subtotal := v_subtotal + (prod.precio + delta) * (it->>'cantidad')::bigint;
  end loop;

  if p_canal = 'delivery' then
    if v_subtotal < l.pedido_minimo then raise exception 'pedido_minimo_no_alcanzado'; end if;
    v_envio := case when l.envio_gratis_desde is not null and v_subtotal >= l.envio_gratis_desde
                    then 0 else l.envio end;
  end if;

  update pedidos set subtotal = v_subtotal, envio = v_envio, total = v_subtotal + v_envio
   where id = p_id;

  insert into pedido_eventos (id, pedido_id, local_id, tipo, actor, dispositivo)
  values (gen_random_uuid(), p_id, l.id, 'nuevo', 'cliente', 'app');

  return jsonb_build_object('id', p_id, 'numero', n, 'subtotal', v_subtotal,
                            'envio', v_envio, 'total', v_subtotal + v_envio);
end $$;

grant execute on function crear_pedido(uuid,text,canal_pedido,text,text,text,text,metodo_pago,bigint,text,jsonb,text) to anon, authenticated;
grant execute on function local_disponible(uuid) to anon, authenticated;

-- =============================================================
-- SEGUIMIENTO DEL CLIENTE (sin sesión, solo con el id del pedido)
-- =============================================================
create or replace function seguir_pedido(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'numero', p.numero, 'estado', p.estado, 'estado_en', p.estado_en,
    'canal', p.canal, 'total', p.total, 'repartidor', p.repartidor,
    'eventos', (select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'en', e.creado_en) order by e.creado_en)
                  from pedido_eventos e where e.pedido_id = p.id)
  ) from pedidos p where p.id = p_id;
$$;
grant execute on function seguir_pedido(uuid) to anon, authenticated;

-- =============================================================
-- VISTA DEL REPARTIDOR (solo con el token del link)
-- =============================================================
create or replace function entrega_por_token(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'pedido', p.numero, 'pedido_id', p.id, 'cliente', p.cliente, 'telefono', p.telefono,
    'direccion', p.direccion, 'referencia', p.referencia, 'nota', p.nota,
    'canal', p.canal, 'pago', p.pago_metodo, 'pago_estado', p.pago_estado,
    'total', p.total, 'paga_con', p.paga_con, 'estado', p.estado,
    'repartidor', e.repartidor, 'salio_en', e.asignado_en,
    'items', (select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad,
                                                  'opciones', i.opciones, 'quitados', i.quitados)
                                order by i.orden) from pedido_items i where i.pedido_id = p.id)
  ) into r
  from entregas e join pedidos p on p.id = e.pedido_id
  where e.token = p_token and e.expira_en > now();

  if r is null then raise exception 'entrega_no_valida'; end if;
  return r;
end $$;
grant execute on function entrega_por_token(text) to anon, authenticated;

create or replace function entrega_marcar(p_token text, p_estado estado_pedido, p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e entregas;
begin
  select * into e from entregas where token = p_token and expira_en > now();
  if not found then raise exception 'entrega_no_valida'; end if;
  if p_estado not in ('enviado','entregado') then raise exception 'estado_no_permitido'; end if;

  insert into pedido_eventos (id, pedido_id, local_id, tipo, actor, dispositivo, datos)
  values (gen_random_uuid(), e.pedido_id, e.local_id, p_estado, coalesce(e.repartidor,'repartidor'),
          'link', jsonb_build_object('detalle', p_detalle));

  if p_estado = 'entregado' then
    update entregas set entregado_en = now(), expira_en = now() where id = e.id;
    update pedidos set pago_estado = 'pagado' where id = e.pedido_id and pago_metodo = 'efectivo';
  end if;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function entrega_marcar(text, estado_pedido, text) to anon, authenticated;
