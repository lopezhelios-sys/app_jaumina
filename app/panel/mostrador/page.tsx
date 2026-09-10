'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-panel';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { formatearGuaranies } from '@/lib/formato';
import { generarIdPedido } from '@/lib/carrito';

type EstadoPedido = 'nuevo' | 'cocina' | 'listo' | 'enviado' | 'entregado' | 'cancelado';

interface Pedido {
  id: string;
  numero: number;
  fecha: string;
  canal: string;
  cliente: string;
  telefono: string | null;
  direccion: string | null;
  total: number;
  pago_metodo: string;
  estado: EstadoPedido;
  estado_en: string;
  creado_en: string;
  nota: string | null;
}

const ESTADOS_TEXTO: Record<EstadoPedido, string> = {
  nuevo: 'Nuevo',
  cocina: 'En cocina',
  listo: 'Listo',
  enviado: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

const ESTADOS_COLOR: Record<EstadoPedido, string> = {
  nuevo: 'bg-yellow-100 text-yellow-800',
  cocina: 'bg-blue-100 text-blue-800',
  listo: 'bg-green-100 text-green-800',
  enviado: 'bg-purple-100 text-purple-800',
  entregado: 'bg-gray-100 text-gray-600',
  cancelado: 'bg-red-100 text-red-600',
};

export default function PaginaMostrador() {
  const { usuarioLocal, cargando: cargandoAuth, cerrarSesion } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevosPedidos, setNuevosPedidos] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!usuarioLocal) return;

    const supabase = crearClienteNavegador();

    // Cargar pedidos del día
    const cargarPedidos = async () => {
      const hoy = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('local_id', usuarioLocal.localId)
        .eq('fecha', hoy)
        .order('creado_en', { ascending: false });

      if (!error && data) {
        setPedidos(data as Pedido[]);
      }
      setCargando(false);
    };

    cargarPedidos();

    // Suscribirse a eventos de pedidos
    const canal = supabase
      .channel('pedido_eventos_mostrador')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedido_eventos',
          filter: `local_id=eq.${usuarioLocal.localId}`,
        },
        (payload) => {
          // Recargar pedidos cuando hay un evento nuevo
          cargarPedidos();

          // Si es un pedido nuevo, reproducir sonido y destacar
          if (payload.new.tipo === 'nuevo') {
            const pedidoId = (payload.new as any).pedido_id;
            setNuevosPedidos((prev) => new Set(prev).add(pedidoId));

            // Reproducir sonido
            if (audioRef.current) {
              audioRef.current.play().catch(() => {
                // Ignorar error si el navegador bloquea el autoplay
              });
            }

            // Quitar destacado después de 5 segundos
            setTimeout(() => {
              setNuevosPedidos((prev) => {
                const nuevo = new Set(prev);
                nuevo.delete(pedidoId);
                return nuevo;
              });
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      canal.unsubscribe();
    };
  }, [usuarioLocal]);

  const cambiarEstado = async (pedidoId: string, nuevoEstado: EstadoPedido) => {
    if (!usuarioLocal) return;

    const supabase = crearClienteNavegador();
    const eventoId = generarIdPedido();

    await supabase.from('pedido_eventos').insert({
      id: eventoId,
      pedido_id: pedidoId,
      local_id: usuarioLocal.localId,
      tipo: nuevoEstado,
      actor: 'mostrador',
      dispositivo: 'panel',
      datos: {},
    });
  };

  const cancelarPedido = async (pedidoId: string) => {
    const motivo = prompt('¿Por qué cancelás el pedido?');
    if (!motivo) return;

    if (!usuarioLocal) return;

    const supabase = crearClienteNavegador();
    const eventoId = generarIdPedido();

    await supabase.from('pedido_eventos').insert({
      id: eventoId,
      pedido_id: pedidoId,
      local_id: usuarioLocal.localId,
      tipo: 'cancelado',
      actor: 'mostrador',
      dispositivo: 'panel',
      datos: { motivo },
    });
  };

  if (cargandoAuth || cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  if (!usuarioLocal) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-600">No tenés permisos para acceder</p>
      </div>
    );
  }

  const pedidosActivos = pedidos.filter((p) => !['entregado', 'cancelado'].includes(p.estado));
  const pedidosFinalizados = pedidos.filter((p) => ['entregado', 'cancelado'].includes(p.estado));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Audio para notificación (silencio de 1 segundo) */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
      />

      {/* Header */}
      <header className="bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Mostrador · Pedidos de hoy</h1>
          <button
            onClick={cerrarSesion}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="p-4">
        {/* Pedidos activos */}
        <section className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">Activos ({pedidosActivos.length})</h2>

          {pedidosActivos.length === 0 ? (
            <p className="text-gray-500">No hay pedidos activos</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pedidosActivos.map((pedido) => {
                const esNuevo = nuevosPedidos.has(pedido.id);

                return (
                  <div
                    key={pedido.id}
                    className={`rounded-lg bg-white p-4 shadow transition-all ${
                      esNuevo ? 'ring-4 ring-yellow-400' : ''
                    }`}
                  >
                    {/* Encabezado */}
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-2xl font-bold">#{pedido.numero}</h3>
                        <p className="text-sm text-gray-600 capitalize">{pedido.canal}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          ESTADOS_COLOR[pedido.estado]
                        }`}
                      >
                        {ESTADOS_TEXTO[pedido.estado]}
                      </span>
                    </div>

                    {/* Datos del cliente */}
                    <div className="mb-3 space-y-1 text-sm">
                      <p className="font-semibold">{pedido.cliente}</p>
                      {pedido.telefono && <p className="text-gray-600">{pedido.telefono}</p>}
                      {pedido.direccion && (
                        <p className="text-gray-600">{pedido.direccion}</p>
                      )}
                    </div>

                    {/* Total y pago */}
                    <div className="mb-3 border-t pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total</span>
                        <span className="font-bold">{formatearGuaranies(pedido.total)} Gs.</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Pago</span>
                        <span className="capitalize">{pedido.pago_metodo}</span>
                      </div>
                    </div>

                    {/* Nota */}
                    {pedido.nota && (
                      <div className="mb-3 rounded bg-yellow-50 p-2 text-sm italic text-gray-700">
                        "{pedido.nota}"
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="space-y-2">
                      {pedido.estado === 'nuevo' && (
                        <button
                          onClick={() => cambiarEstado(pedido.id, 'cocina')}
                          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                          Aceptar → Cocina
                        </button>
                      )}

                      {pedido.estado === 'cocina' && (
                        <button
                          onClick={() => cambiarEstado(pedido.id, 'listo')}
                          className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700"
                        >
                          Marcar listo
                        </button>
                      )}

                      {pedido.estado === 'listo' && pedido.canal === 'delivery' && (
                        <button
                          onClick={() => cambiarEstado(pedido.id, 'enviado')}
                          className="w-full rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                        >
                          Salió para entrega
                        </button>
                      )}

                      {pedido.estado === 'listo' && pedido.canal === 'retiro' && (
                        <button
                          onClick={() => cambiarEstado(pedido.id, 'entregado')}
                          className="w-full rounded-lg bg-gray-600 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                        >
                          Entregado
                        </button>
                      )}

                      {!['cancelado', 'entregado'].includes(pedido.estado) && (
                        <button
                          onClick={() => cancelarPedido(pedido.id)}
                          className="w-full rounded-lg border border-red-600 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pedidos finalizados */}
        {pedidosFinalizados.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">
              Finalizados ({pedidosFinalizados.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {pedidosFinalizados.map((pedido) => (
                <div key={pedido.id} className="rounded-lg bg-white p-3 shadow">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">#{pedido.numero}</h3>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        ESTADOS_COLOR[pedido.estado]
                      }`}
                    >
                      {ESTADOS_TEXTO[pedido.estado]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{pedido.cliente}</p>
                  <p className="text-sm font-semibold">
                    {formatearGuaranies(pedido.total)} Gs.
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
