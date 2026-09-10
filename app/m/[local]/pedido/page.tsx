'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteNavegador } from '@/lib/supabase/navegador';
import { useCarrito, generarIdPedido } from '@/lib/carrito';
import { formatearGuaranies } from '@/lib/formato';
import { rutaDeLocal } from '@/lib/rutas';
import { calcularPrecioUnitario } from '@/lib/tipos-carrito';

type CanalPedido = 'delivery' | 'retiro' | 'mesa';
type MetodoPago = 'efectivo' | 'transferencia' | 'qr' | 'tarjeta';

interface FormData {
  canal: CanalPedido;
  cliente: string;
  telefono: string;
  direccion: string;
  referencia: string;
  pago: MetodoPago;
  pagaCon: string;
  nota: string;
}

export default function PaginaCheckout({
  params,
}: {
  params: Promise<{ local: string }>;
}) {
  const router = useRouter();
  const [localSlug, setLocalSlug] = useState<string>('');
  const { items, subtotal, vaciar } = useCarrito(localSlug);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    canal: 'delivery',
    cliente: '',
    telefono: '',
    direccion: '',
    referencia: '',
    pago: 'efectivo',
    pagaCon: '',
    nota: '',
  });

  useEffect(() => {
    params.then((p) => setLocalSlug(p.local));
  }, [params]);

  // Redirigir si el carrito está vacío
  useEffect(() => {
    if (localSlug && items.length === 0) {
      router.push(rutaDeLocal(localSlug));
    }
  }, [localSlug, items.length, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validarFormulario = (): string | null => {
    if (!form.cliente.trim()) return 'Ingresá tu nombre';
    if (!form.telefono.trim()) return 'Ingresá tu teléfono';

    if (form.canal === 'delivery') {
      if (!form.direccion.trim()) return 'Ingresá tu dirección';
    }

    if (form.pago === 'efectivo' && form.pagaCon) {
      const monto = parseInt(form.pagaCon);
      if (isNaN(monto) || monto < subtotal) {
        return 'El monto debe ser mayor o igual al total';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errorValidacion = validarFormulario();
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const supabase = crearClienteNavegador();
      const pedidoId = generarIdPedido();

      // Construir items para la API
      const itemsApi = items.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        opciones: item.opciones.map((o) => o.id),
        quitados: item.quitados,
        nota: item.nota || null,
      }));

      const { data, error: errorApi } = await supabase.rpc('crear_pedido', {
        p_id: pedidoId,
        p_local_slug: localSlug,
        p_canal: form.canal,
        p_cliente: form.cliente.trim(),
        p_telefono: form.telefono.trim(),
        p_direccion: form.canal === 'delivery' ? form.direccion.trim() : null,
        p_referencia: form.canal === 'delivery' ? form.referencia.trim() : null,
        p_pago: form.pago,
        p_paga_con: form.pago === 'efectivo' && form.pagaCon ? parseInt(form.pagaCon) : null,
        p_nota: form.nota.trim() || null,
        p_items: itemsApi,
        p_mesa: form.canal === 'mesa' ? null : null, // TODO: implementar selección de mesa
      });

      if (errorApi) {
        console.error('Error al crear pedido:', errorApi);

        // Errores específicos que vienen de la función
        if (errorApi.message.includes('local_no_encontrado')) {
          setError('El local no está disponible en este momento');
        } else if (errorApi.message.includes('producto_no_disponible')) {
          setError(
            'Algún producto ya no está disponible. Revisá tu carrito y volvé a intentar.'
          );
        } else if (errorApi.message.includes('pedido_minimo_no_alcanzado')) {
          setError('No alcanzás el pedido mínimo para delivery');
        } else if (errorApi.message.includes('pedido_vacio')) {
          setError('Tu carrito está vacío');
        } else {
          setError('Hubo un problema al crear el pedido. Intentá de nuevo.');
        }
        return;
      }

      // Éxito: vaciar carrito y redirigir al seguimiento
      vaciar();
      router.push(rutaDeLocal(localSlug, `/pedido/${pedidoId}`));
    } catch (err) {
      console.error('Error inesperado:', err);
      setError('Ocurrió un error inesperado. Verificá tu conexión y volvé a intentar.');
    } finally {
      setEnviando(false);
    }
  };

  if (!localSlug || items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Encabezado */}
      <header className="bg-white p-4 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
            aria-label="Volver"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Confirmar pedido</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resumen del pedido */}
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Tu pedido</h2>
            <div className="space-y-2 text-sm">
              {items.map((item, i) => {
                const precioUnit = calcularPrecioUnitario(item);
                return (
                  <div key={i} className="flex justify-between">
                    <span>
                      {item.cantidad}x {item.nombre}
                    </span>
                    <span>{formatearGuaranies(precioUnit * item.cantidad)} Gs.</span>
                  </div>
                );
              })}
              <div className="border-t pt-2 font-semibold">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatearGuaranies(subtotal)} Gs.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Canal */}
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <label className="mb-2 block font-semibold">¿Cómo lo querés?</label>
            <select
              name="canal"
              value={form.canal}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 p-3 focus:border-gray-400 focus:outline-none"
            >
              <option value="delivery">Delivery</option>
              <option value="retiro">Retiro en el local</option>
            </select>
          </section>

          {/* Datos del cliente */}
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">Tus datos</h2>
            <div className="space-y-3">
              <input
                type="text"
                name="cliente"
                value={form.cliente}
                onChange={handleChange}
                placeholder="Nombre completo"
                className="w-full rounded-lg border border-gray-300 p-3 focus:border-gray-400 focus:outline-none"
                required
              />
              <input
                type="tel"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Teléfono"
                className="w-full rounded-lg border border-gray-300 p-3 focus:border-gray-400 focus:outline-none"
                required
              />
            </div>
          </section>

          {/* Datos de entrega (solo para delivery) */}
          {form.canal === 'delivery' && (
            <section className="rounded-lg bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">¿A dónde lo llevamos?</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  name="direccion"
                  value={form.direccion}
                  onChange={handleChange}
                  placeholder="Dirección"
                  className="w-full rounded-lg border border-gray-300 p-3 focus:border-gray-400 focus:outline-none"
                  required
                />
                <input
                  type="text"
                  name="referencia"
                  value={form.referencia}
                  onChange={handleChange}
                  placeholder="Referencia (opcional)"
                  className="w-full rounded-lg border border-gray-300 p-3 focus:border-gray-400 focus:outline-none"
                />
              </div>
            </section>
          )}

          {/* Método de pago */}
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold">¿Cómo vas a pagar?</h2>
            <select
              name="pago"
              value={form.pago}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 p-3 focus:border-gray-400 focus:outline-none"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="qr">QR</option>
              <option value="tarjeta">Tarjeta</option>
            </select>

            {form.pago === 'efectivo' && (
              <input
                type="number"
                name="pagaCon"
                value={form.pagaCon}
                onChange={handleChange}
                placeholder="¿Con cuánto pagás? (opcional)"
                className="mt-3 w-full rounded-lg border border-gray-300 p-3 focus:border-gray-400 focus:outline-none"
              />
            )}
          </section>

          {/* Nota */}
          <section className="rounded-lg bg-white p-4 shadow-sm">
            <label className="mb-2 block font-semibold">Nota (opcional)</label>
            <textarea
              name="nota"
              value={form.nota}
              onChange={handleChange}
              placeholder="Alguna aclaración para tu pedido..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 p-3 focus:border-gray-400 focus:outline-none"
            />
          </section>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-red-700">
              <p className="font-semibold">⚠️ {error}</p>
            </div>
          )}

          {/* Botón enviar */}
          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-full py-4 font-bold text-white transition-colors hover:opacity-90 disabled:bg-gray-300 disabled:text-gray-500"
            style={{
              backgroundColor: enviando ? undefined : 'var(--color-primario)',
            }}
          >
            {enviando ? 'Enviando pedido...' : `Confirmar pedido · ${formatearGuaranies(subtotal)} Gs.`}
          </button>
        </form>
      </main>
    </div>
  );
}
