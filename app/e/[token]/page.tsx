'use client';

import { useState, useEffect } from 'react';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { formatearGuaranies } from '@/lib/formato';

interface DatosViaje {
  viaje_id: string;
  repartidor: string;
  telefono: string | null;
  estado: string;
  creado_en: string;
  efectivo_a_rendir: number;
  efectivo_cobrado: number;
  marca: any;
  paradas: Parada[];
}

interface Parada {
  parada_id: string;
  pedido_id: string;
  orden: number;
  estado: string;
  monto_cobrado: number | null;
  motivo_falla: string | null;
  marcado_en: string | null;
  pedido: {
    numero: number;
    cliente: string;
    telefono: string | null;
    direccion: string;
    referencia: string | null;
    nota: string | null;
    pago_metodo: string;
    pago_estado: string;
    total: number;
    paga_con: number | null;
    vuelto: number;
    items: Array<{
      nombre: string;
      cantidad: number;
      notas: string | null;
      quitados: string[] | null;
    }>;
  };
}

type Motivo = 'No encuentro la dirección' | 'Nadie atiende' | 'El cliente rechazó el pedido' | 'No pude cobrar' | 'Problema con la moto';

const MOTIVOS: Motivo[] = [
  'No encuentro la dirección',
  'Nadie atiende',
  'El cliente rechazó el pedido',
  'No pude cobrar',
  'Problema con la moto',
];

export default function PaginaViaje({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string>('');
  const [datos, setDatos] = useState<DatosViaje | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paradaActualIndex, setParadaActualIndex] = useState(0);
  const [llegueParadas, setLlegueParadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;

    const obtenerDatos = async () => {
      try {
        const supabase = crearClienteNavegador();
        const { data, error: errorApi } = await supabase.rpc('viaje_por_token', {
          p_token: token,
        });

        if (errorApi || !data) {
          setError('Este link no es válido o ya venció');
          return;
        }

        setDatos(data as DatosViaje);

        // Encontrar primera parada pendiente
        const primeraPendiente = data.paradas.findIndex(
          (p: Parada) => p.estado === 'pendiente' || p.estado === 'en_camino' || p.estado === 'llegue'
        );
        if (primeraPendiente !== -1) {
          setParadaActualIndex(primeraPendiente);
        }
      } catch (err) {
        console.error('Error al obtener viaje:', err);
        setError('Ocurrió un error');
      } finally {
        setCargando(false);
      }
    };

    obtenerDatos();
  }, [token]);

  const marcarLlegue = async (pedidoId: string) => {
    if (!token) return;

    const supabase = crearClienteNavegador();
    await supabase.rpc('parada_marcar', {
      p_token: token,
      p_pedido_id: pedidoId,
      p_estado: 'llegue',
    });

    setLlegueParadas((prev) => new Set(prev).add(pedidoId));
  };

  const confirmarEntrega = async (pedidoId: string, montoCobrado: number | null) => {
    if (!token) return;

    const supabase = crearClienteNavegador();
    await supabase.rpc('parada_marcar', {
      p_token: token,
      p_pedido_id: pedidoId,
      p_estado: 'entregado',
      p_monto_cobrado: montoCobrado,
    });

    // Recargar datos
    location.reload();
  };

  const marcarFallido = async (pedidoId: string, motivo: Motivo) => {
    if (!token) return;

    const confirmacion = confirm(`¿Reportar: ${motivo}?`);
    if (!confirmacion) return;

    const supabase = crearClienteNavegador();
    await supabase.rpc('parada_marcar', {
      p_token: token,
      p_pedido_id: pedidoId,
      p_estado: 'fallido',
      p_motivo: motivo,
    });

    // Recargar datos
    location.reload();
  };

  const abrirMapa = (direccion: string) => {
    const destino = encodeURIComponent(direccion);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
    window.open(url, '_blank');
  };

  const abrirWaze = (direccion: string) => {
    const destino = encodeURIComponent(direccion);
    const url = `https://waze.com/ul?q=${destino}&navigate=yes`;
    window.open(url, '_blank');
  };

  const abrirRecorridoCompleto = () => {
    if (!datos) return;

    const paradasPendientes = datos.paradas.filter(
      (p) => p.estado === 'pendiente' || p.estado === 'en_camino' || p.estado === 'llegue'
    );

    if (paradasPendientes.length === 0) return;

    // Origen: primera parada
    const origen = encodeURIComponent(paradasPendientes[0].pedido.direccion);

    // Destino: última parada
    const destino = encodeURIComponent(paradasPendientes[paradasPendientes.length - 1].pedido.direccion);

    // Waypoints: paradas intermedias
    const waypoints = paradasPendientes
      .slice(1, -1)
      .map((p) => encodeURIComponent(p.pedido.direccion))
      .join('|');

    const url = waypoints
      ? `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&waypoints=${waypoints}`
      : `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}`;

    window.open(url, '_blank');
  };

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <p className="text-xl font-semibold">{error || 'Link no válido'}</p>
        </div>
      </div>
    );
  }

  // Verificar si el viaje está completado
  const todasCompletas = datos.paradas.every(
    (p) => p.estado === 'entregado' || p.estado === 'fallido'
  );

  if (todasCompletas) {
    const paradasEntregadas = datos.paradas.filter((p) => p.estado === 'entregado').length;
    const paradasFallidas = datos.paradas.filter((p) => p.estado === 'fallido').length;
    const tiempoTotal = Math.floor(
      (new Date().getTime() - new Date(datos.creado_en).getTime()) / 1000 / 60
    );

    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <div className="mb-4 text-6xl">✅</div>
          <h1 className="mb-2 text-2xl font-bold">Viaje completado</h1>
          <div className="mt-4 space-y-1 text-gray-600">
            <p>
              Entregadas: {paradasEntregadas} · Fallidas: {paradasFallidas}
            </p>
            <p>Tiempo total: {tiempoTotal} minutos</p>
            <p className="text-lg font-bold">
              A rendir: {formatearGuaranies(datos.efectivo_cobrado)} Gs.
            </p>
          </div>
          <p className="mt-6 text-sm text-gray-400">Este link ya no es válido</p>
        </div>
      </div>
    );
  }

  const paradaActual = datos.paradas[paradaActualIndex];
  const llegueActual = llegueParadas.has(paradaActual.pedido_id) || paradaActual.estado === 'llegue';

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Encabezado fijo */}
      <header
        className="sticky top-0 z-10 bg-purple-600 p-4 text-white shadow-lg"
        style={{
          backgroundColor: datos.marca?.colorPrimario || '#9333ea',
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm opacity-90">{datos.repartidor}</p>
          <p className="text-sm font-bold">
            Parada {paradaActualIndex + 1} de {datos.paradas.length}
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full bg-white transition-all"
            style={{
              width: `${((paradaActualIndex + 1) / datos.paradas.length) * 100}%`,
            }}
          />
        </div>

        <p className="text-center text-sm">
          A rendir: <span className="font-bold">{formatearGuaranies(datos.efectivo_a_rendir)} Gs.</span>
        </p>
      </header>

      <main className="space-y-4 p-4">
        {/* Parada actual */}
        <section className="rounded-lg bg-white p-6 shadow-lg ring-2 ring-purple-500">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">
              Pedido #{paradaActual.pedido.numero}
            </h2>
            <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700">
              ACTUAL
            </span>
          </div>

          {/* Dirección */}
          <div className="mb-4">
            <h3 className="mb-2 text-2xl font-bold">{paradaActual.pedido.direccion}</h3>
            {paradaActual.pedido.referencia && (
              <div className="rounded-lg bg-yellow-50 p-3">
                <p className="font-semibold text-yellow-900">
                  📍 {paradaActual.pedido.referencia}
                </p>
              </div>
            )}
          </div>

          {/* Botones de navegación */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => abrirMapa(paradaActual.pedido.direccion)}
              className="flex-1 rounded-lg bg-blue-600 py-3 font-semibold text-white"
            >
              Google Maps
            </button>
            <button
              onClick={() => abrirWaze(paradaActual.pedido.direccion)}
              className="flex-1 rounded-lg bg-sky-500 py-3 font-semibold text-white"
            >
              Waze
            </button>
          </div>

          {/* Cliente */}
          <div className="mb-4">
            <p className="mb-2 text-lg font-bold">{paradaActual.pedido.cliente}</p>
            {paradaActual.pedido.telefono && (
              <div className="flex gap-2">
                <a
                  href={`tel:${paradaActual.pedido.telefono}`}
                  className="flex-1 rounded-lg bg-green-600 py-3 text-center font-semibold text-white"
                >
                  📞 Llamar
                </a>
                <a
                  href={`https://wa.me/${paradaActual.pedido.telefono.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-green-500 py-3 text-center font-semibold text-white"
                >
                  WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Cobro */}
          <div className="mb-4">
            {paradaActual.pedido.pago_estado === 'pagado' ? (
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-700">✓ YA PAGADO</p>
                <p className="text-green-600">No cobrar</p>
              </div>
            ) : (
              <div>
                <p className="mb-2 text-sm uppercase text-gray-600">
                  Cobro en {paradaActual.pedido.pago_metodo}
                </p>
                <p className="mb-2 text-4xl font-bold">
                  {formatearGuaranies(paradaActual.pedido.total)} Gs.
                </p>

                {paradaActual.pedido.vuelto > 0 && (
                  <div className="rounded-lg bg-orange-50 p-3">
                    <p className="text-sm text-gray-700">
                      Paga con: {formatearGuaranies(paradaActual.pedido.paga_con || 0)} Gs.
                    </p>
                    <p className="text-lg font-bold text-orange-700">
                      Vuelto: {formatearGuaranies(paradaActual.pedido.vuelto)} Gs.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="mb-4">
            <h3 className="mb-2 font-semibold">Chequear bolsa:</h3>
            <ul className="space-y-2">
              {paradaActual.pedido.items.map((item, i) => (
                <li key={i}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-700">
                      {item.cantidad}
                    </span>
                    <span className={item.quitados && item.quitados.length > 0 ? 'text-red-600' : ''}>
                      {item.nombre}
                    </span>
                  </div>
                  {item.quitados && item.quitados.length > 0 && (
                    <p className="ml-11 text-sm text-red-600">
                      Sin: {item.quitados.join(', ')}
                    </p>
                  )}
                  {item.notas && (
                    <p className="ml-11 text-sm italic text-gray-600">{item.notas}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {paradaActual.pedido.nota && (
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-sm font-semibold text-gray-700">
                Nota: {paradaActual.pedido.nota}
              </p>
            </div>
          )}
        </section>

        {/* Otras paradas */}
        {datos.paradas.length > 1 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Próximas paradas</h3>
              <button
                onClick={abrirRecorridoCompleto}
                className="text-sm font-semibold text-purple-600 hover:underline"
              >
                Ver todo el recorrido →
              </button>
            </div>

            <div className="space-y-2">
              {datos.paradas.map((parada, index) => {
                if (index === paradaActualIndex) return null;

                const estadoEmoji =
                  parada.estado === 'entregado'
                    ? '✅'
                    : parada.estado === 'fallido'
                      ? '❌'
                      : '⏳';

                return (
                  <button
                    key={parada.parada_id}
                    onClick={() => setParadaActualIndex(index)}
                    className="w-full rounded-lg bg-white p-3 text-left shadow transition-all hover:ring-2 hover:ring-purple-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">
                          {estadoEmoji} {index + 1}. {parada.pedido.cliente}
                        </p>
                        <p className="text-sm text-gray-600">
                          {parada.pedido.direccion.split(',')[0]}
                        </p>
                      </div>
                      {parada.pedido.pago_metodo === 'efectivo' &&
                        parada.estado !== 'fallido' && (
                          <span className="text-sm font-bold text-green-700">
                            💵 {formatearGuaranies(parada.pedido.total)}
                          </span>
                        )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Footer con acciones */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-lg">
        {!llegueActual ? (
          <button
            onClick={() => marcarLlegue(paradaActual.pedido_id)}
            className="w-full rounded-lg bg-purple-600 py-4 text-lg font-bold text-white"
          >
            ✓ Llegué
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => {
                if (paradaActual.pedido.pago_metodo === 'efectivo') {
                  const monto = prompt(
                    `¿Cuánto cobraste? (Total: ${formatearGuaranies(paradaActual.pedido.total)} Gs.)`
                  );
                  if (monto) {
                    confirmarEntrega(paradaActual.pedido_id, parseInt(monto));
                  }
                } else {
                  confirmarEntrega(paradaActual.pedido_id, null);
                }
              }}
              className="w-full rounded-lg bg-green-600 py-4 text-lg font-bold text-white"
            >
              → Confirmar entrega
            </button>

            <div className="grid grid-cols-2 gap-2">
              {MOTIVOS.slice(0, 4).map((motivo) => (
                <button
                  key={motivo}
                  onClick={() => marcarFallido(paradaActual.pedido_id, motivo)}
                  className="rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700"
                >
                  {motivo.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const motivo = MOTIVOS[4]; // "Problema con la moto"
                marcarFallido(paradaActual.pedido_id, motivo);
              }}
              className="w-full rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700"
            >
              {MOTIVOS[4]}
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
