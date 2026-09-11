-- =============================================================
-- Ja'umina · correcciones sobre viajes
-- Ajustá los nombres de tabla y de los valores de enum si en tu 0003
-- quedaron distintos (acá se asume: paradas, viajes.estado = 'en_curso').
-- =============================================================

-- -------------------------------------------------------------
-- 1) Un pedido no puede estar en dos viajes abiertos a la vez.
--
-- El índice parcial con subconsulta NO sirve: Postgres rechaza
-- subconsultas en el predicado de un índice. Va con trigger.
--
-- La regla exacta: el bloqueo solo aplica si la parada anterior
-- sigue abierta (pendiente o llegado). Si falló, el pedido se
-- puede reasignar a otro repartidor, que es lo que hay que hacer
-- cuando nadie atendió y se reintenta más tarde.
-- -------------------------------------------------------------
create or replace function validar_pedido_un_viaje()
returns trigger language plpgsql as $$
declare v_otro uuid;
begin
  select v.id into v_otro
    from paradas p
    join viajes  v on v.id = p.viaje_id
   where p.pedido_id = new.pedido_id
     and p.viaje_id <> new.viaje_id
     and v.estado = 'en_curso'
     and p.estado in ('pendiente','llegue')
   limit 1;

  if v_otro is not null then
    raise exception 'pedido_ya_en_viaje'
      using detail = format('El pedido %s sigue abierto en el viaje %s', new.pedido_id, v_otro),
            hint   = 'Cerrá o marcá como fallida la parada anterior antes de reasignarlo.';
  end if;
  return new;
end $$;

drop trigger if exists trg_pedido_un_viaje on paradas;
create trigger trg_pedido_un_viaje
before insert or update of viaje_id, pedido_id on paradas
for each row execute function validar_pedido_un_viaje();

-- -------------------------------------------------------------
-- 2) El efectivo a rendir se calcula, no se guarda.
--
-- Si el frontend lo filtra por su cuenta, el repartidor y el
-- mostrador pueden mostrar números distintos, y esa cifra es
-- plata que alguien tiene que entregar al volver. Una sola
-- fuente: el servidor.
-- -------------------------------------------------------------
create or replace function efectivo_a_rendir(p_viaje uuid)
returns bigint language sql stable as $$
  select coalesce(sum(ped.total), 0)
    from paradas p
    join pedidos ped on ped.id = p.pedido_id
   where p.viaje_id = p_viaje
     and ped.pago_metodo = 'efectivo'
     and p.estado <> 'fallido';
$$;

-- Lo cobrado de verdad, para el cierre de caja:
create or replace function efectivo_cobrado(p_viaje uuid)
returns bigint language sql stable as $$
  select coalesce(sum(ped.total), 0)
    from paradas p
    join pedidos ped on ped.id = p.pedido_id
   where p.viaje_id = p_viaje
     and ped.pago_metodo = 'efectivo'
     and p.estado = 'entregado';
$$;

grant execute on function efectivo_a_rendir(uuid) to anon, authenticated;
grant execute on function efectivo_cobrado(uuid)  to anon, authenticated;

-- -------------------------------------------------------------
-- 3) Actualizar viaje_por_token() para devolver efectivo calculado
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION viaje_por_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resultado json;
BEGIN
  SELECT json_build_object(
    'viaje_id', v.id,
    'repartidor', v.repartidor,
    'telefono', v.telefono,
    'estado', v.estado,
    'creado_en', v.creado_en,
    'efectivo_a_rendir', efectivo_a_rendir(v.id),
    'efectivo_cobrado', efectivo_cobrado(v.id),
    'marca', l.marca,
    'paradas', (
      SELECT json_agg(
        json_build_object(
          'parada_id', pa.id,
          'pedido_id', pa.pedido_id,
          'orden', pa.orden,
          'estado', pa.estado,
          'monto_cobrado', pa.monto_cobrado,
          'motivo_falla', pa.motivo_falla,
          'marcado_en', pa.marcado_en,
          'pedido', json_build_object(
            'numero', p.numero,
            'cliente', p.cliente,
            'telefono', p.telefono,
            'direccion', p.direccion,
            'referencia', p.referencia,
            'nota', p.nota,
            'pago_metodo', p.pago_metodo,
            'pago_estado', p.pago_estado,
            'total', p.total,
            'paga_con', p.paga_con,
            'vuelto', CASE
              WHEN p.paga_con > p.total THEN p.paga_con - p.total
              ELSE 0
            END,
            'items', (
              SELECT json_agg(json_build_object(
                'nombre', pr.nombre,
                'cantidad', pi.cantidad,
                'notas', pi.notas,
                'quitados', pi.quitados
              ))
              FROM pedido_items pi
              JOIN productos pr ON pi.producto_id = pr.id
              WHERE pi.pedido_id = p.id
            )
          )
        )
        ORDER BY pa.orden
      )
      FROM paradas pa
      JOIN pedidos p ON pa.pedido_id = p.id
      WHERE pa.viaje_id = v.id
    )
  ) INTO resultado
  FROM viajes v
  JOIN locales l ON v.local_id = l.id
  WHERE v.token = p_token
  LIMIT 1;

  RETURN resultado;
END;
$$;

-- -------------------------------------------------------------
-- 4) Verificación rápida después de aplicar
-- -------------------------------------------------------------
-- Debe devolver una fila por viaje abierto, sin pedidos repetidos:
--   select p.pedido_id, count(*)
--     from paradas p join viajes v on v.id = p.viaje_id
--    where v.estado = 'en_curso' and p.estado in ('pendiente','llegue')
--    group by 1 having count(*) > 1;
--   (sin filas = correcto)
