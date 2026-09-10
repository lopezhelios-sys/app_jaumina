/**
 * Rutas y URLs del sistema
 *
 * REGLA: Ninguna URL pública se escribe a mano en otro archivo.
 * Toda URL pasa por estas funciones. Así, si mañana cada local
 * tiene su propio dominio, solo cambiamos este archivo.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Resuelve el slug del local desde los parámetros de ruta.
 * Es el único lugar que sabe de dónde sale el slug.
 */
export async function resolverLocal(
  params: Promise<{ local: string }>
): Promise<string> {
  const { local } = await params;
  return local;
}

/**
 * Arma cualquier URL pública del sistema a partir del slug del local.
 *
 * @param slug - Slug del local (ej: "lamera")
 * @param ruta - Ruta relativa opcional (ej: "/pedido/123")
 * @returns URL completa (ej: "https://jaumina.com.py/m/lamera/pedido/123")
 *
 * @example
 * urlDeLocal("lamera")                    → https://jaumina.com.py/m/lamera
 * urlDeLocal("lamera", "/pedido/abc")     → https://jaumina.com.py/m/lamera/pedido/abc
 */
export function urlDeLocal(slug: string, ruta?: string): string {
  const rutaCompleta = `/m/${slug}${ruta ?? ''}`;
  return `${BASE_URL}${rutaCompleta}`;
}

/**
 * Variante para uso en Server Components que genera rutas relativas
 * (sin dominio). Útil para Link de Next.js.
 */
export function rutaDeLocal(slug: string, ruta?: string): string {
  return `/m/${slug}${ruta ?? ''}`;
}
