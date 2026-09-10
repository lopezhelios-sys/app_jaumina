/**
 * Tipo para la marca de un local
 */
export interface MarcaLocal {
  colorPrimario: string;
  colorSecundario: string;
  colorTexto: string;
  colorFondo: string;
}

/**
 * Convierte la marca de un local en variables CSS
 */
export function generarVariablesCSS(marca: MarcaLocal): Record<string, string> {
  return {
    '--color-primario': marca.colorPrimario,
    '--color-secundario': marca.colorSecundario,
    '--color-texto': marca.colorTexto,
    '--color-fondo': marca.colorFondo,
  };
}
