'use client';

import { useState } from 'react';
import { formatearGuaranies } from '@/lib/formato';
import { ModalOpciones } from './ModalOpciones';
import type { ProductoCompleto } from '@/lib/tipos-menu';

interface Props {
  producto: ProductoCompleto;
  localSlug: string;
}

export function ProductoCard({ producto, localSlug }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <>
      <article className="rounded-lg border p-4 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{producto.nombre}</h3>

            {producto.descriptor && (
              <p className="mt-1 text-sm text-gray-500">{producto.descriptor}</p>
            )}

            {producto.ingredientes.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                {producto.ingredientes.join(' · ')}
              </p>
            )}

            {producto.porcion && (
              <p className="mt-2 text-xs text-gray-500">{producto.porcion}</p>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-lg font-bold">{formatearGuaranies(producto.precio)} Gs.</p>

              <button
                onClick={() => setModalAbierto(true)}
                className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                style={{ backgroundColor: 'var(--color-primario)' }}
              >
                Agregar
              </button>
            </div>
          </div>

          {producto.ilustracion && (
            <div className="text-4xl">{producto.ilustracion}</div>
          )}
        </div>
      </article>

      {modalAbierto && (
        <ModalOpciones
          producto={producto}
          localSlug={localSlug}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </>
  );
}
