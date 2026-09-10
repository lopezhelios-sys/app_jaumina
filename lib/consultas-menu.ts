import { crearClienteServidor } from './supabase/servidor';
import type { GrupoOpciones, Opcion } from './tipos-menu';

/**
 * Obtiene los grupos de opciones y sus opciones para un conjunto de productos
 */
export async function obtenerGruposDeProductos(
  localId: string,
  productosIds: string[]
): Promise<Map<string, GrupoOpciones[]>> {
  const supabase = await crearClienteServidor();

  // Obtener la relación producto -> grupos
  const { data: relaciones } = await supabase
    .from('producto_grupos')
    .select('producto_id, grupo_id, orden')
    .in('producto_id', productosIds)
    .order('orden');

  if (!relaciones || relaciones.length === 0) {
    return new Map();
  }

  const gruposIds = [...new Set(relaciones.map((r) => r.grupo_id))];

  // Obtener los grupos
  const { data: grupos } = await supabase
    .from('grupos_opciones')
    .select('*')
    .in('id', gruposIds)
    .eq('local_id', localId);

  // Obtener las opciones de todos los grupos
  const { data: opciones } = await supabase
    .from('opciones')
    .select('*')
    .in('grupo_id', gruposIds)
    .eq('local_id', localId)
    .eq('disponible', true)
    .order('orden');

  if (!grupos || !opciones) {
    return new Map();
  }

  // Agrupar opciones por grupo_id
  const opcionesPorGrupo = new Map<string, Opcion[]>();
  for (const opcion of opciones) {
    const lista = opcionesPorGrupo.get(opcion.grupo_id) || [];
    lista.push(opcion as Opcion);
    opcionesPorGrupo.set(opcion.grupo_id, lista);
  }

  // Construir los grupos completos
  const gruposCompletos = grupos.map((g) => ({
    ...g,
    opciones: opcionesPorGrupo.get(g.id) || [],
  })) as GrupoOpciones[];

  // Mapear grupos por producto_id
  const resultado = new Map<string, GrupoOpciones[]>();
  for (const rel of relaciones) {
    const grupo = gruposCompletos.find((g) => g.id === rel.grupo_id);
    if (grupo) {
      const lista = resultado.get(rel.producto_id) || [];
      lista.push(grupo);
      resultado.set(rel.producto_id, lista);
    }
  }

  // Ordenar grupos por el orden de la relación
  for (const [productoId, grupos] of resultado) {
    const ordenMap = new Map(
      relaciones.filter((r) => r.producto_id === productoId).map((r) => [r.grupo_id, r.orden])
    );
    grupos.sort((a, b) => (ordenMap.get(a.id) || 0) - (ordenMap.get(b.id) || 0));
  }

  return resultado;
}
