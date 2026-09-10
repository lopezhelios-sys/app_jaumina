'use client';

import { useState, useEffect } from 'react';
import { useCarrito } from '@/lib/carrito';
import { formatearGuaranies } from '@/lib/formato';
import { calcularPrecioUnitario } from '@/lib/tipos-carrito';
import type { ProductoCompleto, GrupoOpciones } from '@/lib/tipos-menu';
import type { ItemCarrito, OpcionSeleccionada } from '@/lib/tipos-carrito';

interface Props {
  producto: ProductoCompleto;
  localSlug: string;
  onCerrar: () => void;
}

export function ModalOpciones({ producto, localSlug, onCerrar }: Props) {
  const { agregarItem } = useCarrito(localSlug);
  const [cantidad, setCantidad] = useState(1);
  const [opcionesSeleccionadas, setOpcionesSeleccionadas] = useState<
    Map<string, string[]>
  >(new Map());
  const [quitados, setQuitados] = useState<Set<string>>(new Set());
  const [nota, setNota] = useState('');

  // Inicializar opciones por defecto
  useEffect(() => {
    const inicial = new Map<string, string[]>();
    for (const grupo of producto.grupos) {
      const porDefecto = grupo.opciones.filter((o) => o.por_defecto).map((o) => o.id);
      if (porDefecto.length > 0) {
        inicial.set(grupo.id, porDefecto);
      }
    }
    setOpcionesSeleccionadas(inicial);
  }, [producto.grupos]);

  const toggleOpcion = (grupo: GrupoOpciones, opcionId: string) => {
    setOpcionesSeleccionadas((prev) => {
      const nuevo = new Map(prev);
      const seleccionadas = nuevo.get(grupo.id) || [];

      if (grupo.tipo === 'unica') {
        // Única: reemplazar
        nuevo.set(grupo.id, [opcionId]);
      } else {
        // Múltiple: toggle
        if (seleccionadas.includes(opcionId)) {
          const filtradas = seleccionadas.filter((id) => id !== opcionId);
          if (filtradas.length === 0) {
            nuevo.delete(grupo.id);
          } else {
            nuevo.set(grupo.id, filtradas);
          }
        } else {
          // Respetar max_selec
          if (grupo.max_selec && seleccionadas.length >= grupo.max_selec) {
            return prev; // No agregar más
          }
          nuevo.set(grupo.id, [...seleccionadas, opcionId]);
        }
      }

      return nuevo;
    });
  };

  const toggleQuitado = (ingrediente: string) => {
    setQuitados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(ingrediente)) {
        nuevo.delete(ingrediente);
      } else {
        nuevo.add(ingrediente);
      }
      return nuevo;
    });
  };

  const construirItem = (): ItemCarrito => {
    const opciones: OpcionSeleccionada[] = [];
    let nivelPicante = producto.picante_base;

    for (const grupo of producto.grupos) {
      const ids = opcionesSeleccionadas.get(grupo.id) || [];
      for (const id of ids) {
        const opcion = grupo.opciones.find((o) => o.id === id);
        if (opcion) {
          opciones.push({
            id: opcion.id,
            nombre: opcion.nombre,
            delta: opcion.precio_delta,
          });
          if (opcion.nivel_picante !== null) {
            nivelPicante = opcion.nivel_picante;
          }
        }
      }
    }

    return {
      productoId: producto.id,
      nombre: producto.nombre,
      descriptor: producto.descriptor,
      precioBase: producto.precio,
      cantidad,
      opciones,
      quitados: Array.from(quitados),
      nivelPicante,
      nota,
    };
  };

  const puedeAgregar = (): boolean => {
    // Verificar que se cumplan los min_selec de todos los grupos
    for (const grupo of producto.grupos) {
      const seleccionadas = opcionesSeleccionadas.get(grupo.id) || [];
      if (seleccionadas.length < grupo.min_selec) {
        return false;
      }
    }
    return true;
  };

  const handleAgregar = () => {
    if (!puedeAgregar()) return;

    const item = construirItem();
    agregarItem(item);
    onCerrar();
  };

  const item = construirItem();
  const precioUnitario = calcularPrecioUnitario(item);
  const precioTotal = precioUnitario * cantidad;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{producto.nombre}</h2>
              {producto.descriptor && (
                <p className="mt-1 text-sm text-gray-500">{producto.descriptor}</p>
              )}
            </div>
            <button
              onClick={onCerrar}
              className="text-2xl text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>

        {/* Grupos de opciones */}
        {producto.grupos.map((grupo) => {
          const seleccionadas = opcionesSeleccionadas.get(grupo.id) || [];
          const faltaSeleccionar = grupo.min_selec - seleccionadas.length;

          return (
            <div key={grupo.id} className="mb-6">
              <div className="mb-2">
                <h3 className="font-semibold">
                  {grupo.nombre}
                  {grupo.min_selec > 0 && (
                    <span className="ml-2 text-sm font-normal text-red-500">
                      (obligatorio)
                    </span>
                  )}
                </h3>
                {grupo.ayuda && <p className="text-sm text-gray-500">{grupo.ayuda}</p>}
              </div>

              <div className="space-y-2">
                {grupo.opciones.map((opcion) => {
                  const seleccionada = seleccionadas.includes(opcion.id);

                  return (
                    <button
                      key={opcion.id}
                      onClick={() => toggleOpcion(grupo, opcion.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        seleccionada
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{opcion.nombre}</span>
                        <div className="flex items-center gap-2">
                          {opcion.precio_delta > 0 && (
                            <span className="text-sm text-gray-600">
                              +{formatearGuaranies(opcion.precio_delta)} Gs.
                            </span>
                          )}
                          <div
                            className={`h-5 w-5 rounded-full border-2 ${
                              seleccionada ? 'border-black bg-black' : 'border-gray-300'
                            } flex items-center justify-center`}
                          >
                            {seleccionada && (
                              <svg
                                className="h-3 w-3 text-white"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {faltaSeleccionar > 0 && (
                <p className="mt-1 text-sm text-red-500">
                  Seleccioná {faltaSeleccionar} opción{faltaSeleccionar > 1 ? 'es' : ''}
                </p>
              )}
            </div>
          );
        })}

        {/* Quitados */}
        {producto.ingredientes.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 font-semibold">¿Querés quitar algo?</h3>
            <div className="flex flex-wrap gap-2">
              {producto.ingredientes.map((ingrediente) => {
                const quitado = quitados.has(ingrediente);
                return (
                  <button
                    key={ingrediente}
                    onClick={() => toggleQuitado(ingrediente)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      quitado
                        ? 'border-red-500 bg-red-50 text-red-700 line-through'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {ingrediente}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nota */}
        <div className="mb-6">
          <label className="mb-2 block font-semibold">Nota para la cocina (opcional)</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: sin sal, bien cocido..."
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-gray-400 focus:outline-none"
            rows={2}
            maxLength={200}
          />
        </div>

        {/* Cantidad y total */}
        <div className="sticky bottom-0 border-t bg-white pt-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-semibold">Cantidad</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                className="h-8 w-8 rounded-full border border-gray-300 hover:bg-gray-100"
              >
                −
              </button>
              <span className="w-8 text-center font-semibold">{cantidad}</span>
              <button
                onClick={() => setCantidad((c) => c + 1)}
                className="h-8 w-8 rounded-full border border-gray-300 hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={handleAgregar}
            disabled={!puedeAgregar()}
            className="w-full rounded-full bg-black py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500"
            style={{
              backgroundColor: puedeAgregar() ? 'var(--color-primario)' : undefined,
            }}
          >
            Agregar · {formatearGuaranies(precioTotal)} Gs.
          </button>
        </div>
      </div>
    </div>
  );
}
