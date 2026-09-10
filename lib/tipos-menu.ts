/**
 * Tipos para el menú público
 */

export interface Opcion {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_delta: number;
  nivel_picante: number | null;
  disponible: boolean;
  por_defecto: boolean;
  orden: number;
}

export interface GrupoOpciones {
  id: string;
  slug: string;
  nombre: string;
  ayuda: string | null;
  tipo: 'unica' | 'multiple';
  min_selec: number;
  max_selec: number | null;
  orden: number;
  opciones: Opcion[];
}

export interface ProductoCompleto {
  id: string;
  slug: string;
  nombre: string;
  descriptor: string | null;
  ingredientes: string[];
  porcion: string | null;
  precio: number;
  imagen_url: string | null;
  ilustracion: string | null;
  picante_base: number;
  destacado: boolean;
  orden: number;
  categoria: string;
  categoria_nombre: string;
  categoria_orden: number;
  grupos: GrupoOpciones[];
}
