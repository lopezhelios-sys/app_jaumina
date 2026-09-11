'use client';

import { useState, useEffect } from 'react';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { formatearGuaranies } from '@/lib/formato';
import { generarIdPedido } from '@/lib/carrito';

interface DatosEntrega {
  pedido: number;
  pedido_id: string;
  local_id: string;
  cliente: string;
  telefono: string | null;
  direccion: string;
  referencia: string | null;
  nota: string | null;
  canal: string;
  pago: string;
  pago_estado: string;
  total: number;
  paga_con: number | null;
  estado: string;
  repartidor: string | null;
  salio_en: string;
  items: Array<{ nombre: string; cantidad: number }>;
}

type Problema =
  | 'no_encuentro'
  | 'nadie_atiende'
  | 'rechazo'
  | 'problema_moto'
  | null;

export default function PaginaRepartidor({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string>('');
  const [datos, setDatos] = useState<DatosEntrega | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [llegue, setLlegue] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [entregado, setEntregado] = useState(false);
  const [tiempoTotal, setTiempoTotal] = useState<number>(0);

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (!token) return;

    const obtenerDatos = async () => {
      try {
        const supabase = crearClienteNavegador();
        const { data, error: errorApi } = await supabase.rpc('entrega_por_token', {
          p_token: token,
        });

        if (errorApi || !data) {
          setError('Este link no es válido o ya venció');
          return;
        }

        setDatos(data as DatosEntrega);
        setEntregado(data.estado === 'entregado');
      } catch (err) {
        console.error('Error al obtener entrega:', err);
        setError('Ocurrió un error');
      } finally {
        setCargando(false);
      }
    };

    obtenerDatos();
  }, [token]);

  const marcarLlegue = async () => {
    if (!datos || !token) return;

    const supabase = crearClienteNavegador();
    await supabase.rpc('entrega_marcar', {
      p_token: token,
      p_estado: 'enviado',
      p_detalle: 'Llegó al destino',
    });

    setLlegue(true);
  };

  const confirmarEntrega = async () => {
    if (!datos || !token) return;

    setEntregando(true);

    const supabase = crearClienteNavegador();
    await supabase.rpc('entrega_marcar', {
      p_token: token,
      p_estado: 'entregado',
      p_detalle: 'Entrega confirmada',
    });

    // Calcular tiempo total
    const inicio = new Date(datos.salio_en).getTime();
    const fin = new Date().getTime();
    const minutos = Math.floor((fin - inicio) / 1000 / 60);
    setTiempoTotal(minutos);

    setEntregado(true);
    setEntregando(false);
  };

  const reportarProblema = async (tipo: Problema) => {
    if (!datos || !token) return;

    const mensajes: Record<string, string> = {
      no_encuentro: 'No encuentro la dirección',
      nadie_atiende: 'Nadie atiende',
      rechazo: 'El cliente rechazó el pedido',
      problema_moto: 'Problema con la moto',
    };

    const confirmacion = confirm(`¿Reportar: ${mensajes[tipo!]}?`);
    if (!confirmacion) return;

    const supabase = crearClienteNavegador();
    const eventoId = generarIdPedido();

    await supabase.from('incidencias').insert({
      id: eventoId,
      local_id: datos.local_id,
      pedido_id: datos.pedido_id,
      origen: 'repartidor',
      detalle: mensajes[tipo!],
    });

    alert('Problema reportado. Mostrador fue notificado.');
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

  if (entregado) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <div className="mb-4 text-6xl">✅</div>
          <h1 className="mb-2 text-2xl font-bold">Entrega completada</h1>
          <p className="text-lg text-gray-600">Pedido #{datos.pedido}</p>
          {tiempoTotal > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              Tiempo total: {tiempoTotal} minutos
            </p>
          )}
          <p className="mt-6 text-sm text-gray-400">Este link ya no es válido</p>
        </div>
      </div>
    );
  }

  const abrirMapa = (app: 'google' | 'waze') => {
    const destino = encodeURIComponent(datos.direccion);
    const url =
      app === 'google'
        ? `https://www.google.com/maps/dir/?api=1&destination=${destino}`
        : `https://waze.com/ul?q=${destino}&navigate=yes`;
    window.open(url, '_blank');
  };

  const vuelto = datos.paga_con && datos.paga_con > datos.total
    ? datos.paga_con - datos.total
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-purple-600 p-4 text-white">
        <h1 className="text-center text-xl font-bold">
          Entrega #{datos.pedido}
        </h1>
        {datos.repartidor && (
          <p className="text-center text-sm opacity-90">{datos.repartidor}</p>
        )}
      </header>

      <main className="space-y-4 p-4">
        {/* Dirección */}
        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-3 text-2xl font-bold">{datos.direccion}</h2>
          {datos.referencia && (
            <div className="mb-4 rounded-lg bg-yellow-50 p-3">
              <p className="font-semibold text-yellow-900">
                📍 {datos.referencia}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => abrirMapa('google')}
              className="flex-1 rounded-lg bg-blue-600 py-3 font-semibold text-white"
            >
              Google Maps
            </button>
            <button
              onClick={() => abrirMapa('waze')}
              className="flex-1 rounded-lg bg-sky-500 py-3 font-semibold text-white"
            >
              Waze
            </button>
          </div>
        </section>

        {/* Cliente */}
        <section className="rounded-lg bg-white p-6 shadow">
          <p className="mb-3 text-xl font-bold">{datos.cliente}</p>
          {datos.telefono && (
            <div className="flex gap-2">
              <a
                href={`tel:${datos.telefono}`}
                className="flex-1 rounded-lg bg-green-600 py-3 text-center font-semibold text-white"
              >
                📞 Llamar
              </a>
              <a
                href={`https://wa.me/${datos.telefono.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-green-500 py-3 text-center font-semibold text-white"
              >
                WhatsApp
              </a>
            </div>
          )}
        </section>

        {/* Cobro */}
        <section className="rounded-lg bg-white p-6 shadow">
          {datos.pago_estado === 'pagado' ? (
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">✓ YA PAGADO</p>
              <p className="text-green-600">No cobrar</p>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm text-gray-600 uppercase">
                Cobro en {datos.pago}
              </p>
              <p className="mb-4 text-4xl font-bold">
                {formatearGuaranies(datos.total)} Gs.
              </p>

              {datos.paga_con && vuelto > 0 && (
                <div className="rounded-lg bg-orange-50 p-3">
                  <p className="text-sm text-gray-700">
                    Paga con: {formatearGuaranies(datos.paga_con)} Gs.
                  </p>
                  <p className="text-lg font-bold text-orange-700">
                    Vuelto: {formatearGuaranies(vuelto)} Gs.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Pedido */}
        <section className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-3 font-semibold">Chequear bolsa:</h3>
          <ul className="space-y-2">
            {datos.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-700">
                  {item.cantidad}
                </span>
                <span>{item.nombre}</span>
              </li>
            ))}
          </ul>
        </section>

        {datos.nota && (
          <section className="rounded-lg bg-yellow-50 p-4 shadow">
            <p className="text-sm font-semibold text-gray-700">
              Nota: {datos.nota}
            </p>
          </section>
        )}
      </main>

      {/* Footer con acciones */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-lg">
        {!llegue ? (
          <button
            onClick={marcarLlegue}
            className="w-full rounded-lg bg-purple-600 py-4 text-lg font-bold text-white"
          >
            ✓ Llegué
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={confirmarEntrega}
              disabled={entregando}
              className="w-full rounded-lg bg-green-600 py-4 text-lg font-bold text-white disabled:bg-gray-300"
            >
              {entregando ? 'Confirmando...' : '→ Deslizá para confirmar entrega'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => reportarProblema('no_encuentro')}
                className="rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700"
              >
                No encuentro
              </button>
              <button
                onClick={() => reportarProblema('nadie_atiende')}
                className="rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700"
              >
                Nadie atiende
              </button>
              <button
                onClick={() => reportarProblema('rechazo')}
                className="rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700"
              >
                Rechazo
              </button>
              <button
                onClick={() => reportarProblema('problema_moto')}
                className="rounded-lg bg-red-50 py-2 text-sm font-semibold text-red-700"
              >
                Problema moto
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
