/**
 * Tipos para el carrito de compras
 *
 * El carrito vive en el cliente (localStorage) y se sincroniza
 * con el servidor al crear el pedido.
 */

export interface OpcionSeleccionada {
  id: string;
  nombre: string;
  delta: number; // Incremento de precio (puede ser 0)
}

export interface ItemCarrito {
  productoId: string;
  nombre: string;
  descriptor: string | null;
  precioBase: number; // Precio del producto sin opciones
  cantidad: number;
  opciones: OpcionSeleccionada[];
  quitados: string[]; // Ingredientes que el cliente no quiere
  nivelPicante: number;
  nota: string;
}

export interface Carrito {
  localSlug: string;
  items: ItemCarrito[];
}

/**
 * Calcula el precio unitario de un item (base + opciones)
 */
export function calcularPrecioUnitario(item: ItemCarrito): number {
  const sumaOpciones = item.opciones.reduce((sum, op) => sum + op.delta, 0);
  return item.precioBase + sumaOpciones;
}

/**
 * Calcula el precio total de un item (unitario × cantidad)
 */
export function calcularPrecioItem(item: ItemCarrito): number {
  return calcularPrecioUnitario(item) * item.cantidad;
}

/**
 * Calcula el subtotal del carrito
 */
export function calcularSubtotal(items: ItemCarrito[]): number {
  return items.reduce((sum, item) => sum + calcularPrecioItem(item), 0);
}
