'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-panel';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { formatearGuaranies } from '@/lib/formato';
import { generarIdPedido } from '@/lib/carrito';
import { urlDeLocal } from '@/lib/rutas';

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
  const [linkRepartidor, setLinkRepartidor] = useState<string | null>(null);
  const [incidencias, setIncidencias] = useState<any[]>([]);
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<Set<string>>(new Set());
  const [mostrarModalViaje, setMostrarModalViaje] = useState(false);
  const [datosViaje, setDatosViaje] = useState<{token: string; paradas: number; totalEfectivo: number} | null>(null);
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

    // Cargar incidencias activas
    const cargarIncidencias = async () => {
      const { data, error } = await supabase
        .from('incidencias')
        .select(`
          id,
          pedido_id,
          origen,
          detalle,
          creado_en,
          resuelto,
          pedidos!inner(numero)
        `)
        .eq('local_id', usuarioLocal.localId)
        .eq('resuelto', false)
        .order('creado_en', { ascending: false });

      if (!error && data) {
        setIncidencias(data);
      }
    };

    cargarPedidos();
    cargarIncidencias();

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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidencias',
          filter: `local_id=eq.${usuarioLocal.localId}`,
        },
        () => {
          // Recargar incidencias y reproducir sonido
          cargarIncidencias();

          if (audioRef.current) {
            audioRef.current.play().catch(() => {
              // Ignorar error si el navegador bloquea el autoplay
            });
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

  const generarTokenCorto = () => {
    // Token de 8 caracteres (solo letras y números, sin ambiguos)
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  };

  const asignarRepartidor = async (pedido: Pedido) => {
    const nombre = prompt('Nombre del repartidor:');
    if (!nombre) return;

    if (!usuarioLocal) return;

    const supabase = crearClienteNavegador();
    const token = generarTokenCorto();

    // Crear entrega
    const { error } = await supabase.from('entregas').insert({
      pedido_id: pedido.id,
      local_id: usuarioLocal.localId,
      token,
      repartidor: nombre,
    });

    if (error) {
      alert('Error al crear la entrega');
      return;
    }

    // Actualizar estado del pedido a "enviado"
    await cambiarEstado(pedido.id, 'enviado');

    // Generar link
    const link = urlDeLocal('lamera', `/e/${token}`); // TODO: obtener slug dinámicamente
    setLinkRepartidor(link);
  };

  const resolverIncidencia = async (incidenciaId: string) => {
    if (!usuarioLocal) return;

    const supabase = crearClienteNavegador();

    await supabase
      .from('incidencias')
      .update({ resuelto: true })
      .eq('id', incidenciaId);

    // Quitar de la lista local
    setIncidencias((prev) => prev.filter((i) => i.id !== incidenciaId));
  };

  const toggleSeleccion = (pedidoId: string) => {
    setPedidosSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(pedidoId)) {
        nuevo.delete(pedidoId);
      } else {
        nuevo.add(pedidoId);
      }
      return nuevo;
    });
  };

  const crearViajeConSeleccionados = async () => {
    if (pedidosSeleccionados.size === 0 || !usuarioLocal) return;

    const nombre = prompt('Nombre del repartidor:');
    if (!nombre) return;

    const telefono = prompt('Teléfono (opcional):');

    const supabase = crearClienteNavegador();

    const { data, error } = await supabase.rpc('crear_viaje', {
      p_local_id: usuarioLocal.localId,
      p_repartidor: nombre,
      p_telefono: telefono || null,
      p_pedidos: Array.from(pedidosSeleccionados),
    });

    if (error) {
      alert('Error al crear el viaje');
      console.error(error);
      return;
    }

    // Limpiar selección
    setPedidosSeleccionados(new Set());

    // Mostrar modal con datos del viaje
    setDatosViaje({
      token: data.token,
      paradas: data.paradas,
      totalEfectivo: data.total_efectivo,
    });
    setMostrarModalViaje(true);
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
        {/* Incidencias urgentes */}
        {incidencias.length > 0 && (
          <section className="mb-6">
            <div className="space-y-3">
              {incidencias.map((incidencia) => (
                <div
                  key={incidencia.id}
                  className="rounded-lg bg-red-50 p-4 shadow-lg ring-2 ring-red-500"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold text-red-900">
                        ⚠️ Pedido #{(incidencia.pedidos as any).numero}
                      </p>
                      <p className="text-sm text-red-700">{incidencia.detalle}</p>
                      <p className="mt-1 text-xs text-red-600">
                        Reportado por {incidencia.origen} ·{' '}
                        {new Date(incidencia.creado_en).toLocaleTimeString('es-PY', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => resolverIncidencia(incidencia.id)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Resolver
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pedidos activos */}
        <section className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">Activos ({pedidosActivos.length})</h2>

          {pedidosActivos.length === 0 ? (
            <p className="text-gray-500">No hay pedidos activos</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pedidosActivos.map((pedido) => {
                const esNuevo = nuevosPedidos.has(pedido.id);
                const puedeSeleccionar =
                  pedido.canal === 'delivery' &&
                  (pedido.estado === 'listo' || pedido.estado === 'cocina') &&
                  pedido.estado !== 'enviado';
                const estaSeleccionado = pedidosSeleccionados.has(pedido.id);

                return (
                  <div
                    key={pedido.id}
                    className={`rounded-lg bg-white p-4 shadow transition-all ${
                      esNuevo ? 'ring-4 ring-yellow-400' : ''
                    } ${estaSeleccionado ? 'ring-2 ring-purple-500' : ''}`}
                  >
                    {/* Checkbox de selección */}
                    {puedeSeleccionar && (
                      <div className="mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={estaSeleccionado}
                            onChange={() => toggleSeleccion(pedido.id)}
                            className="h-5 w-5 rounded text-purple-600"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Incluir en viaje
                          </span>
                        </label>
                      </div>
                    )}

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
                          onClick={() => asignarRepartidor(pedido)}
                          className="w-full rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                        >
                          Asignar repartidor
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

      {/* Barra fija para armar viaje */}
      {pedidosSeleccionados.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-purple-600 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <p className="text-lg font-bold">
                {pedidosSeleccionados.size} {pedidosSeleccionados.size === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
              </p>
              <p className="text-sm opacity-90">
                Total: {formatearGuaranies(
                  pedidos
                    .filter((p) => pedidosSeleccionados.has(p.id))
                    .reduce((sum, p) => sum + p.total, 0)
                )} Gs.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPedidosSeleccionados(new Set())}
                className="rounded-lg bg-white/20 px-4 py-3 font-semibold text-white hover:bg-white/30"
              >
                Cancelar
              </button>
              <button
                onClick={crearViajeConSeleccionados}
                className="rounded-lg bg-white px-6 py-3 font-bold text-purple-600 hover:bg-gray-100"
              >
                Armar viaje con {pedidosSeleccionados.size} {pedidosSeleccionados.size === 1 ? 'parada' : 'paradas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de link del repartidor */}
      {linkRepartidor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setLinkRepartidor(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-xl font-bold">Link del repartidor</h2>

            <div className="mb-4 rounded-lg bg-gray-100 p-3">
              <p className="break-all text-sm text-gray-800">{linkRepartidor}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(linkRepartidor);
                  alert('Link copiado');
                }}
                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Copiar link
              </button>

              <button
                onClick={() => {
                  const mensaje = `Tu pedido está en camino. Seguí la entrega acá: ${linkRepartidor}`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700"
              >
                Enviar por WhatsApp
              </button>

              <button
                onClick={() => setLinkRepartidor(null)}
                className="w-full rounded-lg border border-gray-300 py-3 font-semibold hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de viaje creado */}
      {mostrarModalViaje && datosViaje && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setMostrarModalViaje(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-xl font-bold">Viaje creado</h2>

            <div className="mb-4 space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{datosViaje.paradas}</span> {datosViaje.paradas === 1 ? 'parada' : 'paradas'}
              </p>
              <p className="text-sm text-gray-600">
                A rendir en efectivo: <span className="font-bold">{formatearGuaranies(datosViaje.totalEfectivo)} Gs.</span>
              </p>
            </div>

            <div className="mb-4 rounded-lg bg-gray-100 p-3">
              <p className="break-all text-sm text-gray-800">
                {urlDeLocal('lamera', `/e/${datosViaje.token}`)}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const link = urlDeLocal('lamera', `/e/${datosViaje.token}`);
                  navigator.clipboard.writeText(link);
                  alert('Link copiado');
                }}
                className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Copiar link
              </button>

              <button
                onClick={() => {
                  const link = urlDeLocal('lamera', `/e/${datosViaje.token}`);
                  const mensaje = `Viaje con ${datosViaje.paradas} ${datosViaje.paradas === 1 ? 'parada' : 'paradas'}. Tenés que rendir ${formatearGuaranies(datosViaje.totalEfectivo)} Gs. en efectivo. Seguí el viaje acá: ${link}`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700"
              >
                Enviar por WhatsApp
              </button>

              <button
                onClick={() => setMostrarModalViaje(false)}
                className="w-full rounded-lg border border-gray-300 py-3 font-semibold hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
