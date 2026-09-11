# 🚀 Guía de Despliegue Final - Ja'umina en Producción

## ✅ Estado del Proyecto

**Commits completados:**
- ✅ Punto 1: URL base configurada (c9e2c0a)
- ✅ Punto 2: Docker y configuración VPS (bbf29b7)
- ✅ Punto 4: Generación de QR (5e6ea90)

**Pendiente:**
- ⏳ Punto 3: Despliegue y verificación en VPS (requiere acceso al servidor)

---

## 📋 Paso a Paso para Desplegar

### 1️⃣ Pre-requisitos en la VPS Contabo

Verificar que tenés instalado:

```bash
# Docker y Docker Compose
docker --version
docker compose version

# Traefik (proxy inverso con SSL automático)
docker ps | grep traefik

# Red proxy
docker network ls | grep proxy
```

Si falta algo:
```bash
# Crear red proxy
docker network create proxy

# Instalar/configurar Traefik según tu setup habitual
```

---

### 2️⃣ Clonar y Configurar en el Servidor

```bash
# Conectar al servidor
ssh root@tu-servidor-contabo

# Ir a donde guardás los proyectos
cd /opt

# Clonar el repositorio
git clone <url-del-repo> jaumina
cd jaumina

# Crear archivo .env con variables de producción
cat > .env << 'EOF'
NEXT_PUBLIC_BASE_URL=https://jaumina.com.py
NEXT_PUBLIC_SUPABASE_URL=https://enucofogkstivnjeanwr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudWNvZm9na3N0aXZuamVhbndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMDIwMDcsImV4cCI6MjEwNDU3ODAwN30.BLQuKXvCzqDICcSSReV3Euyhgu9STHfOtu-5GNSTqN8
EOF

# Dar permisos al script de despliegue
chmod +x deploy.sh
```

---

### 3️⃣ Verificar DNS

Antes de desplegar, asegurarte que el dominio apunte al servidor:

```bash
# Verificar DNS
dig jaumina.com.py +short
# Debe devolver la IP de tu VPS
```

Si no apunta, configurar en tu proveedor de DNS:
```
Tipo: A
Nombre: @
Valor: <IP-de-tu-VPS>
TTL: 3600
```

---

### 4️⃣ Primer Despliegue

```bash
cd /opt/jaumina
./deploy.sh
```

Esto va a:
1. Hacer pull del código (ya está clonado)
2. Detener contenedor previo (si existe)
3. Construir la imagen Docker
4. Levantar el contenedor
5. Limpiar imágenes antiguas

**Esperá 2-3 minutos** para que:
- El contenedor inicie
- Traefik genere el certificado SSL (primera vez)

---

### 5️⃣ Verificación Básica desde el Servidor

```bash
# Ver logs en tiempo real
docker compose logs -f jaumina

# En otra terminal, verificar que responde
curl -I https://jaumina.com.py

# Debe devolver:
# HTTP/2 200
# ...

# Verificar que el menú carga
curl https://jaumina.com.py/m/lamera | head -20
```

---

### 6️⃣ Verificación desde Celular (CRÍTICO)

**Usar datos móviles, NO wifi de tu casa.**

#### ✅ Checklist de Verificación

1. **Menú público:**
   - [ ] Abrir: `https://jaumina.com.py/m/lamera`
   - [ ] Debe cargar el menú completo
   - [ ] SSL activo (candado verde)
   - [ ] Imágenes cargan correctamente

2. **Hacer un pedido completo:**
   - [ ] Agregar productos al carrito
   - [ ] Abrir carrito → ver items
   - [ ] Ir a checkout
   - [ ] Llenar datos (nombre, teléfono, dirección)
   - [ ] Confirmar pedido
   - [ ] Redirige a página de seguimiento
   - [ ] El seguimiento muestra el pedido

3. **Panel de administración:**
   - [ ] Abrir: `https://jaumina.com.py/panel/entrar`
   - [ ] Login funciona (usuario/contraseña)
   - [ ] Redirige a mostrador
   - [ ] El pedido hecho aparece en "Nuevos"

4. **Panel mostrador:**
   - [ ] Aceptar pedido → pasa a cocina
   - [ ] Marcar listo
   - [ ] Seleccionar 2 pedidos → "Armar viaje"
   - [ ] Asignar repartidor
   - [ ] Modal muestra link del viaje
   - [ ] Copiar link

5. **Vista del repartidor:**
   - [ ] Abrir el link copiado en el celular
   - [ ] Debe mostrar el viaje con las paradas
   - [ ] Barra de progreso visible
   - [ ] Tocar "Llegué" → funciona
   - [ ] Confirmar entrega → funciona
   - [ ] Reportar problema → crea incidencia

6. **Panel cocina:**
   - [ ] Abrir: `https://jaumina.com.py/panel/cocina`
   - [ ] Los pedidos aparecen en columnas
   - [ ] Sin precios (solo productos)
   - [ ] Cronómetro funciona

---

### 7️⃣ Troubleshooting

#### Problema: Certificado SSL no se genera

```bash
# Ver logs de Traefik
docker logs traefik | grep -i letsencrypt

# Verificar que el dominio resuelve
dig jaumina.com.py +short

# Verificar labels de Traefik
docker inspect jaumina | grep -A 10 Labels
```

#### Problema: El contenedor no inicia

```bash
# Ver logs detallados
docker compose logs jaumina

# Verificar variables de entorno
docker compose config

# Verificar que el puerto no está ocupado
lsof -i :3000
```

#### Problema: "Invalid API key" o errores de Supabase

```bash
# Verificar variables en .env
cat .env

# Probar la conexión a Supabase
curl -I https://enucofogkstivnjeanwr.supabase.co
```

#### Problema: El menú carga pero no se pueden hacer pedidos

```bash
# Ver logs del navegador (F12 → Console)
# Verificar que las migraciones están aplicadas en Supabase

# Ir a Supabase Dashboard → SQL Editor
# Verificar que existen las tablas: pedidos, pedido_items, etc.
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

---

### 8️⃣ Imprimir QR del Menú

Una vez verificado que todo funciona:

```bash
# Desde tu máquina local
cd c:\Users\Helio\Desktop\app_jaumina
pnpm generar-qr
```

Los archivos se generan en `public/`:
- `menu-lamera-qr.svg` ← **Usar este para imprimir** (mejor calidad)
- `menu-lamera-qr.png` ← Alternativa

**Recomendaciones para impresión:**
- Tamaño mínimo: 10x10 cm
- Papel: blanco mate
- Agregar texto: "Escaneá para ver el menú"
- Incluir URL debajo: `jaumina.com.py/m/lamera`

---

### 9️⃣ Actualizaciones Futuras

Cuando hagas cambios en el código:

```bash
# En tu máquina local
git add -A
git commit -m "descripción del cambio"
git push origin master

# En el servidor
ssh root@tu-servidor-contabo
cd /opt/jaumina
./deploy.sh
```

El script automáticamente:
1. Hace `git pull`
2. Reconstruye la imagen
3. Reinicia el contenedor
4. Limpia imágenes antiguas

---

## 🎯 Próximos Pasos Después del Despliegue

Una vez que todo esté funcionando:

1. **Cargar productos reales:**
   - Ir al panel dueño (cuando esté implementado)
   - O insertar directamente en Supabase

2. **Configurar marca de La Mera:**
   - Logo en Supabase Storage
   - Colores en `locales.marca`
   - Claim personalizado

3. **Crear usuarios del panel:**
   - Mostrador
   - Cocina
   - Dueño

4. **Probar con pedidos reales:**
   - Hacé que alguien de confianza pruebe el flujo completo
   - Verificá tiempos de carga
   - Verificá que las notificaciones llegan

5. **Imprimir y colocar QR:**
   - En la mesa
   - En la vidriera
   - En el mostrador

---

## 📞 Contactos de Emergencia

**Si algo falla en producción:**

1. Ver logs en tiempo real:
   ```bash
   docker compose logs -f jaumina
   ```

2. Reiniciar el servicio:
   ```bash
   docker compose restart
   ```

3. Volver a la versión anterior:
   ```bash
   git log --oneline  # ver commits
   git checkout <commit-anterior>
   ./deploy.sh
   ```

4. Detener temporalmente:
   ```bash
   docker compose down
   ```

---

## ✅ Checklist Final

Antes de considerar el despliegue completo:

- [ ] VPS configurada con Docker + Traefik
- [ ] DNS apuntando al servidor
- [ ] Proyecto clonado en `/opt/jaumina`
- [ ] Variables en `.env` configuradas
- [ ] `./deploy.sh` ejecutado sin errores
- [ ] SSL activo (candado verde)
- [ ] Menú carga desde celular con datos móviles
- [ ] Pedido completo funciona
- [ ] Panel mostrador accesible
- [ ] Panel cocina accesible
- [ ] Viajes de entrega funcionan
- [ ] QR generado e impreso

**Cuando todos los ítems estén ✅, Ja'umina está en producción.**

---

**¡Éxito con el despliegue! 🚀**
