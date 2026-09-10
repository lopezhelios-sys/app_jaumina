'use client';

import { useState } from 'react';
import { useCarrito } from '@/lib/carrito';
import { formatearGuaranies } from '@/lib/formato';
import { calcularPrecioItem } from '@/lib/tipos-carrito';
import { rutaDeLocal } from '@/lib/rutas';
import Link from 'next/link';

interface Props {
  localSlug: string;
}

export function CarritoFlotante({ localSlug }: Props) {
  const { items, cantidadItems, subtotal, actualizarCantidad, eliminarItem } =
    useCarrito(localSlug);
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  if (cantidadItems === 0) {
    return null;
  }

  return (
    <>
      {/* Badge flotante */}
      <button
        onClick={() => setDrawerAbierto(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
        style={{ backgroundColor: 'var(--color-primario)' }}
        aria-label="Ver carrito"
      >
        <div className="relative">
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-black">
            {cantidadItems}
          </span>
        </div>
      </button>

      {/* Drawer lateral */}
      {drawerAbierto && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          onClick={() => setDrawerAbierto(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado */}
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-xl font-bold">Tu pedido</h2>
              <button
                onClick={() => setDrawerAbierto(false)}
                className="text-2xl text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {/* Items del carrito */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                {items.map((item, index) => {
                  const precioTotal = calcularPrecioItem(item);

                  return (
                    <div key={index} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{item.nombre}</h3>
                          {item.descriptor && (
                            <p className="text-sm text-gray-500">{item.descriptor}</p>
                          )}
                        </div>
                        <button
                          onClick={() => eliminarItem(index)}
                          className="text-red-500 hover:text-red-700"
                          aria-label="Eliminar"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Opciones */}
                      {item.opciones.length > 0 && (
                        <div className="mb-2 text-sm text-gray-600">
                          {item.opciones.map((op, i) => (
                            <div key={i}>
                              • {op.nombre}
                              {op.delta > 0 && ` (+${formatearGuaranies(op.delta)} Gs.)`}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Quitados */}
                      {item.quitados.length > 0 && (
                        <div className="mb-2 text-sm text-gray-500">
                          Sin: {item.quitados.join(', ')}
                        </div>
                      )}

                      {/* Nota */}
                      {item.nota && (
                        <div className="mb-2 text-sm italic text-gray-500">
                          Nota: {item.nota}
                        </div>
                      )}

                      {/* Cantidad y precio */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => actualizarCantidad(index, item.cantidad - 1)}
                            className="h-7 w-7 rounded-full border border-gray-300 hover:bg-gray-100"
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-semibold">{item.cantidad}</span>
                          <button
                            onClick={() => actualizarCantidad(index, item.cantidad + 1)}
                            className="h-7 w-7 rounded-full border border-gray-300 hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-semibold">
                          {formatearGuaranies(precioTotal)} Gs.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer con subtotal y botón */}
            <div className="border-t bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-semibold">Subtotal</span>
                <span className="text-xl font-bold">{formatearGuaranies(subtotal)} Gs.</span>
              </div>

              <Link
                href={rutaDeLocal(localSlug, '/pedido')}
                className="block w-full rounded-full py-3 text-center font-semibold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--color-primario)' }}
                onClick={() => setDrawerAbierto(false)}
              >
                Ir a pagar
              </Link>

              <p className="mt-2 text-center text-xs text-gray-500">
                El envío se calcula en el siguiente paso
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
