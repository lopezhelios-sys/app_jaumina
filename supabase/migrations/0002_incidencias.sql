-- Tabla de incidencias reportadas durante entregas
CREATE TABLE incidencias (
  id uuid PRIMARY KEY,
  local_id uuid REFERENCES locales(id) NOT NULL,
  pedido_id uuid REFERENCES pedidos(id) NOT NULL,
  origen text NOT NULL, -- 'repartidor', 'cliente', 'mostrador'
  detalle text NOT NULL,
  resuelto boolean DEFAULT false,
  creado_en timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX incidencias_local_id_idx ON incidencias(local_id);
CREATE INDEX incidencias_pedido_id_idx ON incidencias(pedido_id);
CREATE INDEX incidencias_resuelto_idx ON incidencias(resuelto);

-- RLS
ALTER TABLE incidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Incidencias: solo del local"
  ON incidencias
  FOR ALL
  USING (local_id = current_setting('app.local_id', true)::uuid);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE incidencias;

-- Función: Obtener datos de entrega por token (sin autenticación)
CREATE OR REPLACE FUNCTION entrega_por_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resultado json;
BEGIN
  SELECT json_build_object(
    'pedido', p.numero,
    'pedido_id', p.id,
    'local_id', p.local_id,
    'cliente', p.cliente,
    'telefono', p.telefono,
    'direccion', p.direccion,
    'referencia', p.referencia,
    'nota', p.nota,
    'canal', p.canal,
    'pago', p.pago_metodo,
    'pago_estado', p.pago_estado,
    'total', p.total,
    'paga_con', p.paga_con,
    'estado', p.estado,
    'repartidor', e.repartidor,
    'salio_en', e.creado_en,
    'items', (
      SELECT json_agg(json_build_object(
        'nombre', pr.nombre,
        'cantidad', pi.cantidad
      ))
      FROM pedido_items pi
      JOIN productos pr ON pi.producto_id = pr.id
      WHERE pi.pedido_id = p.id
    )
  ) INTO resultado
  FROM entregas e
  JOIN pedidos p ON e.pedido_id = p.id
  WHERE e.token = p_token
  LIMIT 1;

  RETURN resultado;
END;
$$;

-- Función: Marcar estado de entrega (sin autenticación)
CREATE OR REPLACE FUNCTION entrega_marcar(
  p_token text,
  p_estado text,
  p_detalle text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido_id uuid;
  v_local_id uuid;
  v_evento_id uuid;
BEGIN
  -- Obtener pedido_id y local_id desde el token
  SELECT e.pedido_id, p.local_id
  INTO v_pedido_id, v_local_id
  FROM entregas e
  JOIN pedidos p ON e.pedido_id = p.id
  WHERE e.token = p_token;

  IF v_pedido_id IS NULL THEN
    RAISE EXCEPTION 'Token no válido';
  END IF;

  -- Generar ID para el evento
  v_evento_id := gen_random_uuid();

  -- Crear evento
  INSERT INTO pedido_eventos (id, pedido_id, local_id, tipo, actor, dispositivo, datos)
  VALUES (v_evento_id, v_pedido_id, v_local_id, p_estado, 'repartidor', 'web', json_build_object('detalle', p_detalle));
END;
$$;
