# Ja'umina - Convenciones del Proyecto

Plataforma para locales gastronómicos de Paraguay: menú digital, pedidos en línea, punto de venta, cocina y delivery.

## Stack Técnico

- **Next.js 16** (App Router) + TypeScript en modo estricto
- **Tailwind CSS v4**
- **Supabase** (Postgres, Auth, Realtime, Storage)
- **pnpm** como gestor de paquetes
- **Despliegue:** VPS propia (Contabo) con salida standalone

**Regla:** No agregar librerías fuera de este stack sin consultar primero. Nada de shadcn, Prisma, Drizzle, ORM ni librerías de estado por ahora.

## Convenciones No Negociables

### 1. Todo en español
- Nombres de variables, funciones, archivos y rutas en español
- Comentarios en español
- Mensajes de commit en español, tiempo imperativo
- Textos de interfaz en español paraguayo, tono directo y humano

### 2. Dinero = Guaraníes enteros
- **Base de datos:** `bigint`
- **TypeScript:** `number` (enteros, nunca decimales)
- **Nunca:** float, decimales, centavos
- **Formato:** `Intl.NumberFormat("es-PY")`

### 3. RLS obligatorio
- Toda tabla nueva lleva `local_id` (columna de tenant)
- Políticas RLS en la misma migración que crea la tabla
- Sin excepciones

### 4. UUID v7 en el cliente
- Generación de IDs en el cliente para identidad definitiva
- Permite crear pedidos sin conexión con ID estable

### 5. Marca del local desde la base
- Colores, logo, claim y nombre del asistente salen de `locales.marca`
- Se inyectan como variables CSS
- **Nunca** hardcodear texto o marca de un local concreto en el código

### 6. Arquitectura multi-tenant
- Ja'umina es la plataforma
- La Mera, o cualquier otro local, es un registro en la tabla `locales`
- Nada de ningún local puede quedar escrito en el código fuente

### 7. Commits atómicos
- Un commit por paso terminado
- Mensaje en español, imperativo
- Ejemplo: `"agrega ruta del menú público"`

## Estructura de Carpetas

```
~/app_jaumina/
├── CLAUDE.md                    # este archivo
├── .env.local                   # nunca al repositorio
├── .env.example                 # nombres de variables, sin valores
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # landing de Ja'umina
│   ├── m/[local]/               # MENÚ PÚBLICO — Server Components + ISR
│   │   ├── page.tsx
│   │   └── pedido/[id]/         # seguimiento del pedido
│   ├── panel/                   # PANEL DEL LOCAL — todo cliente, PWA offline
│   │   ├── layout.tsx
│   │   ├── cocina/              # comandas sin precios
│   │   ├── mostrador/           # pedidos, cobros, venta directa
│   │   └── duenio/              # ventas, carta y configuración
│   ├── e/[token]/               # VISTA DEL REPARTIDOR — sin login
│   └── api/
├── componentes/
│   ├── menu/
│   ├── panel/
│   └── ui/                      # piezas compartidas
├── lib/
│   ├── supabase/
│   │   ├── servidor.ts          # cliente para Server Components
│   │   ├── navegador.ts         # cliente para componentes cliente
│   │   └── tipos.ts             # tipos generados desde la base
│   ├── formato.ts               # guaraníes, fechas, horarios
│   ├── marca.ts                 # convierte locales.marca en CSS variables
│   └── offline/                 # Dexie y cola de salida (futuro)
├── supabase/
│   ├── migrations/
│   └── seed/
└── public/
```

## Criterios de Calidad

### Al agregar una tabla
- Incluir `local_id uuid references locales(id) not null`
- Agregar política RLS en la misma migración
- Documentar el propósito de la tabla en comentario SQL

### Al formatear dinero
```typescript
// ✅ Correcto
const precio = 25000; // guaraníes
const texto = new Intl.NumberFormat('es-PY').format(precio);

// ❌ Incorrecto
const precio = 25000.00; // nunca decimales
const texto = `${precio} Gs.`; // usar Intl
```

### Al aplicar marca del local
```typescript
// ✅ Correcto
style={{ '--color-primario': local.marca.colorPrimario }}

// ❌ Incorrecto
className="bg-orange-500" // color hardcodeado
```

### Antes de cada commit
```bash
# Verificar que no hay texto hardcodeado de locales
grep -r "La Mera" app/ componentes/ lib/
grep -r "Merita" app/ componentes/ lib/
grep -r "#FF6B35" app/ componentes/ lib/  # color de ejemplo
```

## Recordatorios

- **Server Components** para rutas públicas (menú, landing)
- **Client Components** para panel (PWA, offline, interactividad)
- **ISR** para el menú público (`revalidate: 60`)
- **Realtime** para cocina y mostrador (Supabase Realtime)
- **Storage** para imágenes de productos y logos (Supabase Storage)

## Dominio

- Producción: `jaumina.com.py`
- El menú de cada local vive en: `jaumina.com.py/m/[slug-del-local]`
- Ejemplo: `jaumina.com.py/m/lamera`
