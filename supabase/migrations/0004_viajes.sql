-- Migración: Sistema de viajes con múltiples paradas
-- Reemplaza el sistema de entregas individuales por viajes con varias paradas

-- Eliminar funciones anteriores
DROP FUNCTION IF EXISTS entrega_por_token(text);
DROP FUNCTION IF EXISTS entrega_marcar(text, text, text);

-- Tabla de viajes
CREATE TABLE viajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id uuid REFERENCES locales(id) NOT NULL,
  token text UNIQUE NOT NULL,
  repartidor text NOT NULL,
  telefono text,
  estado text DEFAULT 'en_curso', -- en_curso, completado
  creado_en timestamptz DEFAULT now(),
  completado_en timestamptz
);

-- Tabla de paradas (pedidos dentro de un viaje)
CREATE TABLE paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id uuid REFERENCES viajes(id) ON DELETE CASCADE NOT NULL,
  pedido_id uuid REFERENCES pedidos(id) NOT NULL,
  orden int NOT NULL, -- orden de visita
  estado text DEFAULT 'pendiente', -- pendiente, en_camino, llegue, entregado, fallido
  monto_cobrado bigint, -- lo que efectivamente cobró (puede ser null si falla)
  motivo_falla text, -- motivo si estado = fallido
  marcado_en timestamptz,
  UNIQUE(viaje_id, pedido_id)
);

-- Índices
CREATE INDEX viajes_local_id_idx ON viajes(local_id);
CREATE INDEX viajes_token_idx ON viajes(token);
CREATE INDEX viajes_estado_idx ON viajes(estado);
CREATE INDEX paradas_viaje_id_idx ON paradas(viaje_id);
CREATE INDEX paradas_pedido_id_idx ON paradas(pedido_id);
CREATE INDEX paradas_orden_idx ON paradas(viaje_id, orden);

-- RLS
ALTER TABLE viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE paradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viajes: solo del local"
  ON viajes
  FOR ALL
  USING (local_id = current_setting('app.local_id', true)::uuid);

CREATE POLICY "Paradas: solo del local del viaje"
  ON paradas
  FOR ALL
  USING (
    viaje_id IN (
      SELECT id FROM viajes WHERE local_id = current_setting('app.local_id', true)::uuid
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE viajes;
ALTER PUBLICATION supabase_realtime ADD TABLE paradas;

-- Función: Crear viaje con múltiples pedidos
CREATE OR REPLACE FUNCTION crear_viaje(
  p_local_id uuid,
  p_repartidor text,
  p_telefono text,
  p_pedidos uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_viaje_id uuid;
  v_token text;
  v_pedido_id uuid;
  v_orden int := 1;
  v_total_efectivo bigint := 0;
  v_evento_id uuid;
BEGIN
  -- Generar token corto (8 caracteres)
  v_token := substring(md5(random()::text || clock_timestamp()::text) from 1 for 8);

  -- Crear viaje
  INSERT INTO viajes (id, local_id, token, repartidor, telefono)
  VALUES (gen_random_uuid(), p_local_id, v_token, p_repartidor, p_telefono)
  RETURNING id INTO v_viaje_id;

  -- Agregar paradas
  FOREACH v_pedido_id IN ARRAY p_pedidos
  LOOP
    INSERT INTO paradas (viaje_id, pedido_id, orden)
    VALUES (v_viaje_id, v_pedido_id, v_orden);

    -- Crear evento "enviado" para cada pedido
    v_evento_id := gen_random_uuid();
    INSERT INTO pedido_eventos (id, pedido_id, local_id, tipo, actor, dispositivo, datos)
    VALUES (v_evento_id, v_pedido_id, p_local_id, 'enviado', 'mostrador', 'panel',
            json_build_object('viaje_id', v_viaje_id, 'orden', v_orden));

    -- Acumular efectivo a rendir
    SELECT total INTO v_total_efectivo
    FROM pedidos
    WHERE id = v_pedido_id AND pago_metodo = 'efectivo';

    v_orden := v_orden + 1;
  END LOOP;

  RETURN json_build_object(
    'viaje_id', v_viaje_id,
    'token', v_token,
    'paradas', array_length(p_pedidos, 1),
    'total_efectivo', COALESCE(v_total_efectivo, 0)
  );
END;
$$;

-- Función: Obtener viaje completo por token (sin autenticación)
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

-- Función: Marcar estado de una parada (sin autenticación)
CREATE OR REPLACE FUNCTION parada_marcar(
  p_token text,
  p_pedido_id uuid,
  p_estado text,
  p_motivo text DEFAULT NULL,
  p_monto_cobrado bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parada_id uuid;
  v_viaje_id uuid;
  v_local_id uuid;
  v_evento_id uuid;
  v_todas_completas boolean;
BEGIN
  -- Obtener parada, viaje y local
  SELECT pa.id, pa.viaje_id, v.local_id
  INTO v_parada_id, v_viaje_id, v_local_id
  FROM paradas pa
  JOIN viajes v ON pa.viaje_id = v.id
  WHERE v.token = p_token AND pa.pedido_id = p_pedido_id;

  IF v_parada_id IS NULL THEN
    RAISE EXCEPTION 'Parada no encontrada';
  END IF;

  -- Actualizar parada
  UPDATE paradas
  SET estado = p_estado,
      motivo_falla = p_motivo,
      monto_cobrado = p_monto_cobrado,
      marcado_en = now()
  WHERE id = v_parada_id;

  -- Crear evento de pedido
  v_evento_id := gen_random_uuid();
  INSERT INTO pedido_eventos (id, pedido_id, local_id, tipo, actor, dispositivo, datos)
  VALUES (
    v_evento_id,
    p_pedido_id,
    v_local_id,
    CASE
      WHEN p_estado = 'entregado' THEN 'entregado'
      WHEN p_estado = 'fallido' THEN 'cancelado'
      ELSE p_estado
    END,
    'repartidor',
    'web',
    json_build_object(
      'viaje_id', v_viaje_id,
      'estado_parada', p_estado,
      'motivo', p_motivo,
      'monto_cobrado', p_monto_cobrado
    )
  );

  -- Si es fallido, crear incidencia
  IF p_estado = 'fallido' THEN
    INSERT INTO incidencias (id, local_id, pedido_id, origen, detalle)
    VALUES (gen_random_uuid(), v_local_id, p_pedido_id, 'repartidor', p_motivo);
  END IF;

  -- Verificar si todas las paradas están completas
  SELECT NOT EXISTS (
    SELECT 1 FROM paradas
    WHERE viaje_id = v_viaje_id
    AND estado NOT IN ('entregado', 'fallido')
  ) INTO v_todas_completas;

  -- Si todas completas, cerrar viaje
  IF v_todas_completas THEN
    UPDATE viajes
    SET estado = 'completado',
        completado_en = now()
    WHERE id = v_viaje_id;
  END IF;
END;
$$;

-- Función: Reordenar paradas
CREATE OR REPLACE FUNCTION reordenar_paradas(
  p_token text,
  p_nuevo_orden uuid[] -- array de pedido_ids en el nuevo orden
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_viaje_id uuid;
  v_pedido_id uuid;
  v_orden int := 1;
BEGIN
  -- Obtener viaje
  SELECT id INTO v_viaje_id
  FROM viajes
  WHERE token = p_token;

  IF v_viaje_id IS NULL THEN
    RAISE EXCEPTION 'Viaje no encontrado';
  END IF;

  -- Actualizar orden de cada parada
  FOREACH v_pedido_id IN ARRAY p_nuevo_orden
  LOOP
    UPDATE paradas
    SET orden = v_orden
    WHERE viaje_id = v_viaje_id AND pedido_id = v_pedido_id;

    v_orden := v_orden + 1;
  END LOOP;
END;
$$;
