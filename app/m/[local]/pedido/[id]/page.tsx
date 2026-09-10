'use client';

import { useState, useEffect } from 'react';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { formatearGuaranies } from '@/lib/formato';
import Link from 'next/link';
import { rutaDeLocal } from '@/lib/rutas';

type EstadoPedido = 'nuevo' | 'cocina' | 'listo' | 'enviado' | 'entregado' | 'cancelado';

interface Evento {
  tipo: EstadoPedido;
  en: string;
}

interface DatosPedido {
  numero: number;
  estado: EstadoPedido;
  estado_en: string;
  canal: string;
  total: number;
  repartidor: string | null;
  eventos: Evento[];
}

const ESTADOS_TEXTO: Record<EstadoPedido, string> = {
  nuevo: 'Recibido',
  cocina: 'En cocina',
  listo: 'Listo',
  enviado: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const ESTADOS_EMOJI: Record<EstadoPedido, string> = {
  nuevo: '📝',
  cocina: '👨‍🍳',
  listo: '✅',
  enviado: '🛵',
  entregado: '🎉',
  cancelado: '❌',
};

export default function PaginaSeguimientoPedido({
  params,
}: {
  params: Promise<{ local: string; id: string }>;
}) {
  const [localSlug, setLocalSlug] = useState<string>('');
  const [pedidoId, setPedidoId] = useState<string>('');
  const [datos, setDatos] = useState<DatosPedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => {
      setLocalSlug(p.local);
      setPedidoId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (!pedidoId) return;

    const obtenerDatos = async () => {
      try {
        const supabase = crearClienteNavegador();
        const { data, error: errorApi } = await supabase.rpc('seguir_pedido', {
          p_id: pedidoId,
        });

        if (errorApi || !data) {
          setError('No se pudo encontrar el pedido');
          return;
        }

        setDatos(data as DatosPedido);
      } catch (err) {
        console.error('Error al obtener pedido:', err);
        setError('Ocurrió un error al cargar el pedido');
      } finally {
        setCargando(false);
      }
    };

    obtenerDatos();

    // Actualizar cada 10 segundos
    const intervalo = setInterval(obtenerDatos, 10000);

    return () => clearInterval(intervalo);
  }, [pedidoId]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-gray-600">Cargando pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <div className="mb-4 text-4xl">😕</div>
          <h2 className="text-xl font-semibold">{error || 'Pedido no encontrado'}</h2>
          {localSlug && (
            <Link
              href={rutaDeLocal(localSlug)}
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              Volver al menú
            </Link>
          )}
        </div>
      </div>
    );
  }

  const estadoActual = datos.estado;
  const estadosProgreso: EstadoPedido[] =
    datos.canal === 'delivery'
      ? ['nuevo', 'cocina', 'listo', 'enviado', 'entregado']
      : ['nuevo', 'cocina', 'listo'];

  const indexActual = estadosProgreso.indexOf(estadoActual);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Encabezado */}
      <header className="bg-white p-4 shadow-sm">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-bold">Pedido #{datos.numero}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4">
        {/* Estado actual */}
        <section className="mb-6 rounded-lg bg-white p-6 text-center shadow-sm">
          <div className="mb-2 text-6xl">{ESTADOS_EMOJI[estadoActual]}</div>
          <h2 className="text-2xl font-bold">{ESTADOS_TEXTO[estadoActual]}</h2>
          {estadoActual === 'cancelado' ? (
            <p className="mt-2 text-sm text-gray-600">Tu pedido fue cancelado</p>
          ) : estadoActual === 'entregado' ? (
            <p className="mt-2 text-sm text-gray-600">¡Que lo disfrutes!</p>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              Actualizamos el estado automáticamente
            </p>
          )}
        </section>

        {/* Barra de progreso */}
        {estadoActual !== 'cancelado' && (
          <section className="mb-6 rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              {estadosProgreso.map((estado, index) => {
                const completado = index <= indexActual;
                return (
                  <div key={estado} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`mb-1 flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                          completado
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {completado ? '✓' : ESTADOS_EMOJI[estado]}
                      </div>
                      <span className="text-xs text-gray-600">{ESTADOS_TEXTO[estado]}</span>
                    </div>
                    {index < estadosProgreso.length - 1 && (
                      <div
                        className={`mx-2 h-1 flex-1 ${
                          index < indexActual ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Información del pedido */}
        <section className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-semibold">Detalles</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Canal</span>
              <span className="font-medium capitalize">{datos.canal}</span>
            </div>
            {datos.repartidor && (
              <div className="flex justify-between">
                <span className="text-gray-600">Repartidor</span>
                <span className="font-medium">{datos.repartidor}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold">{formatearGuaranies(datos.total)} Gs.</span>
            </div>
          </div>
        </section>

        {/* Historial de eventos */}
        {datos.eventos && datos.eventos.length > 0 && (
          <section className="mb-6 rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-semibold">Historial</h3>
            <div className="space-y-3">
              {datos.eventos
                .slice()
                .reverse()
                .map((evento, i) => (
                  <div key={i} className="flex items-start gap-3 border-l-2 border-gray-200 pl-3">
                    <div className="text-xl">{ESTADOS_EMOJI[evento.tipo]}</div>
                    <div className="flex-1">
                      <p className="font-medium">{ESTADOS_TEXTO[evento.tipo]}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(evento.en).toLocaleString('es-PY', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Botón volver */}
        {localSlug && (
          <Link
            href={rutaDeLocal(localSlug)}
            className="block w-full rounded-full border border-gray-300 py-3 text-center font-semibold transition-colors hover:bg-gray-50"
          >
            Volver al menú
          </Link>
        )}
      </main>
    </div>
  );
}
