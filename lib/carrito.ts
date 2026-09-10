'use client';

import { useState, useEffect } from 'react';
import { uuidv7 } from 'uuidv7';
import type { Carrito, ItemCarrito } from './tipos-carrito';
import { calcularSubtotal } from './tipos-carrito';

const STORAGE_KEY = 'jaumina_carrito';

/**
 * Hook para manejar el carrito de compras
 *
 * El carrito se persiste en localStorage y es específico por local.
 * Si el usuario cambia de local, el carrito se vacía automáticamente.
 */
export function useCarrito(localSlug: string) {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [cargando, setCargando] = useState(true);

  // Cargar carrito desde localStorage al montar
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const carrito: Carrito = JSON.parse(guardado);

        // Si el carrito es de otro local, vaciarlo
        if (carrito.localSlug === localSlug) {
          setItems(carrito.items);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Error al cargar carrito:', error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setCargando(false);
    }
  }, [localSlug]);

  // Guardar en localStorage cuando cambia
  useEffect(() => {
    if (!cargando && items.length > 0) {
      const carrito: Carrito = { localSlug, items };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(carrito));
    } else if (!cargando && items.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [items, localSlug, cargando]);

  const agregarItem = (nuevoItem: ItemCarrito) => {
    setItems((prev) => [...prev, nuevoItem]);
  };

  const actualizarCantidad = (index: number, cantidad: number) => {
    if (cantidad <= 0) {
      eliminarItem(index);
      return;
    }

    setItems((prev) => {
      const nuevo = [...prev];
      nuevo[index] = { ...nuevo[index], cantidad };
      return nuevo;
    });
  };

  const eliminarItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const vaciar = () => {
    setItems([]);
  };

  const subtotal = calcularSubtotal(items);
  const cantidadItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  return {
    items,
    cantidadItems,
    subtotal,
    agregarItem,
    actualizarCantidad,
    eliminarItem,
    vaciar,
    cargando,
  };
}

/**
 * Genera un ID único para un pedido usando UUID v7
 * (ordenable por tiempo, ideal para bases de datos)
 */
export function generarIdPedido(): string {
  return uuidv7();
}
