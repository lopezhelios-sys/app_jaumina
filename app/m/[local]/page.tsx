import { notFound } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/servidor';
import { generarVariablesCSS } from '@/lib/marca';
import { formatearGuaranies } from '@/lib/formato';
import { resolverLocal } from '@/lib/rutas';
import { EstadoLocal } from '@/componentes/menu/EstadoLocal';

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

interface Producto {
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

async function obtenerProductos(slug: string) {
  const supabase = await crearClienteServidor();

  const { data: productos } = await supabase
    .from('menu_publico')
    .select('*')
    .eq('local_slug', slug)
    .order('categoria_orden')
    .order('orden');

  return (productos || []) as Producto[];
}

function agruparPorCategoria(productos: Producto[]) {
  const categorias = new Map<
    string,
    { nombre: string; orden: number; productos: Producto[] }
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

  const productos = await obtenerProductos(slug);
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
                <article
                  key={producto.id}
                  className="rounded-lg border p-4 transition-shadow hover:shadow-md"
                >
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

                      <p className="mt-3 text-lg font-bold">
                        {formatearGuaranies(producto.precio)} Gs.
                      </p>
                    </div>

                    {producto.ilustracion && (
                      <div className="text-4xl">{producto.ilustracion}</div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
