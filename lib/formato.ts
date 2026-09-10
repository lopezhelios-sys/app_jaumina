/**
 * Formatea un número entero como guaraníes paraguayos
 */
export function formatearGuaranies(monto: number): string {
  return new Intl.NumberFormat('es-PY').format(monto);
}

/**
 * Formatea una fecha en español paraguayo
 */
export function formatearFecha(fecha: Date): string {
  return new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'medium',
  }).format(fecha);
}

/**
 * Formatea una hora en formato 24h
 */
export function formatearHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-PY', {
    timeStyle: 'short',
  }).format(fecha);
}
