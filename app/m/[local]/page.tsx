import { notFound } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { generarVariablesCSS } from '@/lib/marca';
import { resolverLocal } from '@/lib/rutas';
import { EstadoLocal } from '@/componentes/menu/EstadoLocal';
import { ProductoCard } from '@/componentes/menu/ProductoCard';
import { obtenerGruposDeProductos } from '@/lib/consultas-menu';
import type { ProductoCompleto } from '@/lib/tipos-menu';

export const revalidate = 60; // ISR: revalidar cada 60 segundos

interface Local {
  id: string;
  slug: string;
  nombre: string;
  claim: string | null;
  logo_url: string | null;
  marca: {
    primario: string;
    oro?: string;
    verde?: string;
    crema?: string;
    fondo?: string;
  };
}

async function obtenerLocal(slug: string) {
  const supabase = await crearClienteServidor();

  const { data: local, error } = await supabase
    .from('locales')
    .select('id, slug, nombre, claim, logo_url, marca')
    .eq('slug', slug)
    .eq('activo', true)
    .single();

  if (error || !local) {
    return null;
  }

  return local as Local;
}

async function obtenerProductos(
  slug: string,
  localId: string
): Promise<ProductoCompleto[]> {
  const supabase = await crearClienteServidor();

  const { data: productos } = await supabase
    .from('menu_publico')
    .select('*')
    .eq('local_slug', slug)
    .order('categoria_orden')
    .order('orden');

  if (!productos || productos.length === 0) {
    return [];
  }

  // Obtener grupos de opciones para todos los productos
  const productosIds = productos.map((p) => p.id);
  const gruposPorProducto = await obtenerGruposDeProductos(localId, productosIds);

  // Combinar productos con sus grupos
  return productos.map((p) => ({
    ...p,
    grupos: gruposPorProducto.get(p.id) || [],
  })) as ProductoCompleto[];
}

function agruparPorCategoria(productos: ProductoCompleto[]) {
  const categorias = new Map<
    string,
    { nombre: string; orden: number; productos: ProductoCompleto[] }
  >();

  for (const producto of productos) {
    if (!categorias.has(producto.categoria)) {
      categorias.set(producto.categoria, {
        nombre: producto.categoria_nombre,
        orden: producto.categoria_orden,
        productos: [],
      });
    }
    categorias.get(producto.categoria)!.productos.push(producto);
  }

  return Array.from(categorias.values()).sort((a, b) => a.orden - b.orden);
}

export default async function PaginaMenuPublico({
  params,
}: {
  params: Promise<{ local: string }>;
}) {
  const slug = await resolverLocal(params);

  const local = await obtenerLocal(slug);
  if (!local) {
    notFound();
  }

  const productos = await obtenerProductos(slug, local.id);
  const categorias = agruparPorCategoria(productos);
  const variablesCSS = generarVariablesCSS({
    colorPrimario: local.marca.primario,
    colorSecundario: local.marca.oro || local.marca.primario,
    colorTexto: local.marca.verde || '#000000',
    colorFondo: local.marca.fondo || '#ffffff',
  });

  return (
    <div className="min-h-screen" style={variablesCSS as React.CSSProperties}>
      {/* Encabezado */}
      <header
        className="px-6 py-8 text-center"
        style={{ backgroundColor: 'var(--color-primario)' }}
      >
        {local.logo_url && (
          <img
            src={local.logo_url}
            alt={local.nombre}
            className="mx-auto mb-4 h-20 object-contain"
          />
        )}
        <h1 className="text-3xl font-bold text-white">{local.nombre}</h1>
        {local.claim && <p className="mt-2 text-lg text-white/90">{local.claim}</p>}
      </header>

      {/* Estado del local (consultado fresco en el cliente) */}
      <EstadoLocal localId={local.id} />

      {/* Menú por categorías */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        {categorias.map((categoria) => (
          <section key={categoria.nombre} className="mb-12">
            <h2 className="mb-6 text-2xl font-bold">{categoria.nombre}</h2>

            <div className="space-y-6">
              {categoria.productos.map((producto) => (
                <ProductoCard key={producto.id} producto={producto} localSlug={slug} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
