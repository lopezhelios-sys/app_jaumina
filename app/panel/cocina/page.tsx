'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-panel';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { generarIdPedido } from '@/lib/carrito';

type EstadoPedido = 'nuevo' | 'cocina' | 'listo' | 'enviado' | 'entregado' | 'cancelado';

interface Item {
  nombre: string;
  descriptor: string | null;
  cantidad: number;
  opciones: Array<{ nombre: string; delta: number }>;
  quitados: string[];
  nivel_picante: number | null;
  nota: string | null;
}

interface Pedido {
  id: string;
  numero: number;
  canal: string;
  estado: EstadoPedido;
  creado_en: string;
  items: Item[];
}

function Cronometro({ desde }: { desde: string }) {
  const [minutos, setMinutos] = useState(0);

  useEffect(() => {
    const calcular = () => {
      const ahora = new Date().getTime();
      const inicio = new Date(desde).getTime();
      const diff = Math.floor((ahora - inicio) / 1000 / 60);
      setMinutos(diff);
    };

    calcular();
    const intervalo = setInterval(calcular, 10000); // Actualizar cada 10 segundos

    return () => clearInterval(intervalo);
  }, [desde]);

  // Colores según el tiempo transcurrido
  const color =
    minutos >= 18
      ? 'bg-red-600 text-white'
      : minutos >= 10
      ? 'bg-orange-500 text-white'
      : 'bg-gray-600 text-white';

  return (
    <div className={`rounded-lg px-3 py-1 text-center text-sm font-bold ${color}`}>
      {minutos} min
    </div>
  );
}

export default function PaginaCocina() {
  const { usuarioLocal, cargando: cargandoAuth, cerrarSesion } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuarioLocal) return;

    const supabase = crearClienteNavegador();

    const cargarPedidos = async () => {
      // Cargar pedidos en cocina o nuevos (por empezar)
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('id, numero, canal, estado, creado_en')
        .eq('local_id', usuarioLocal.localId)
        .in('estado', ['nuevo', 'cocina', 'listo'])
        .order('creado_en', { ascending: true });

      if (pedidosError || !pedidosData) {
        setCargando(false);
        return;
      }

      // Cargar items de cada pedido
      const pedidosConItems = await Promise.all(
        pedidosData.map(async (pedido) => {
          const { data: items } = await supabase
            .from('pedido_items')
            .select('nombre, descriptor, cantidad, opciones, quitados, nivel_picante, nota')
            .eq('pedido_id', pedido.id)
            .order('orden');

          return {
            ...pedido,
            items: (items || []) as Item[],
          };
        })
      );

      setPedidos(pedidosConItems as Pedido[]);
      setCargando(false);
    };

    cargarPedidos();

    // Suscribirse a eventos
    const canal = supabase
      .channel('pedido_eventos_cocina')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pedido_eventos',
          filter: `local_id=eq.${usuarioLocal.localId}`,
        },
        () => {
          cargarPedidos();
        }
      )
      .subscribe();

    return () => {
      canal.unsubscribe();
    };
  }, [usuarioLocal]);

  const marcarListo = async (pedidoId: string) => {
    if (!usuarioLocal) return;

    const supabase = crearClienteNavegador();
    const eventoId = generarIdPedido();

    await supabase.from('pedido_eventos').insert({
      id: eventoId,
      pedido_id: pedidoId,
      local_id: usuarioLocal.localId,
      tipo: 'listo',
      actor: 'cocina',
      dispositivo: 'panel',
      datos: {},
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

  const porEmpezar = pedidos.filter((p) => p.estado === 'nuevo');
  const enPreparacion = pedidos.filter((p) => p.estado === 'cocina');
  const listos = pedidos.filter((p) => p.estado === 'listo');

  const Columna = ({
    titulo,
    pedidos,
    color,
  }: {
    titulo: string;
    pedidos: Pedido[];
    color: string;
  }) => (
    <div className="flex-1 space-y-4">
      <div className={`rounded-t-lg ${color} p-3 text-center font-bold text-white`}>
        {titulo} ({pedidos.length})
      </div>

      <div className="space-y-4">
        {pedidos.map((pedido) => (
          <div key={pedido.id} className="rounded-lg bg-white p-4 shadow">
            {/* Encabezado */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-bold">#{pedido.numero}</h3>
                <p className="text-sm text-gray-600 uppercase">{pedido.canal}</p>
              </div>
              <Cronometro desde={pedido.creado_en} />
            </div>

            {/* Items */}
            <div className="space-y-3">
              {pedido.items.map((item, i) => (
                <div key={i} className="border-l-4 border-blue-500 pl-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{item.cantidad}x</span>
                    <div className="flex-1">
                      <p className="text-lg font-semibold">{item.nombre}</p>
                      {item.descriptor && (
                        <p className="text-sm text-gray-600">{item.descriptor}</p>
                      )}
                    </div>
                  </div>

                  {/* Opciones */}
                  {item.opciones.length > 0 && (
                    <div className="mt-1 space-y-1 text-sm">
                      {item.opciones.map((op, j) => (
                        <p key={j} className="text-blue-700">
                          + {op.nombre}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Quitados (destacados) */}
                  {item.quitados.length > 0 && (
                    <div className="mt-2 rounded bg-red-50 p-2">
                      <p className="text-sm font-semibold text-red-800">
                        SIN: {item.quitados.join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Nota (destacada) */}
                  {item.nota && (
                    <div className="mt-2 rounded bg-yellow-50 p-2">
                      <p className="text-sm font-semibold text-yellow-900">"{item.nota}"</p>
                    </div>
                  )}

                  {/* Nivel de picante */}
                  {item.nivel_picante !== null && item.nivel_picante > 0 && (
                    <p className="mt-1 text-sm text-orange-600">
                      {'🌶️'.repeat(item.nivel_picante)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Botón marcar listo (solo en cocina) */}
            {pedido.estado === 'cocina' && (
              <button
                onClick={() => marcarListo(pedido.id)}
                className="mt-4 w-full rounded-lg bg-green-600 py-3 font-bold text-white hover:bg-green-700"
              >
                Marcar listo
              </button>
            )}
          </div>
        ))}

        {pedidos.length === 0 && (
          <p className="text-center text-sm text-gray-500">Sin pedidos</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-800 p-4 text-white shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Cocina</h1>
          <button
            onClick={cerrarSesion}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm hover:bg-red-700"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="flex gap-4 p-4">
        <Columna titulo="Por empezar" pedidos={porEmpezar} color="bg-yellow-600" />
        <Columna titulo="En preparación" pedidos={enPreparacion} color="bg-blue-600" />
        <Columna titulo="Listos" pedidos={listos} color="bg-green-600" />
      </main>
    </div>
  );
}
