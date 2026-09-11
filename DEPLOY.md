# Despliegue en Producción

## VPS Contabo - jaumina.com.py

### Pre-requisitos en el servidor

1. **Docker y Docker Compose instalados**
2. **Traefik como proxy inverso** (para SSL automático)
3. **Red proxy de Traefik creada:**
   ```bash
   docker network create proxy
   ```
4. **Dominio apuntando al servidor:**
   - `jaumina.com.py` → IP del VPS

### Primera vez

1. **Clonar el repositorio en el servidor:**
   ```bash
   cd /opt
   git clone <url-del-repo> jaumina
   cd jaumina
   ```

2. **Crear archivo `.env` con las variables de producción:**
   ```bash
   cp .env.production.example .env
   # Editar .env con las credenciales reales
   nano .env
   ```

3. **Dar permisos al script de despliegue:**
   ```bash
   chmod +x deploy.sh
   ```

4. **Primer despliegue:**
   ```bash
   ./deploy.sh
   ```

### Actualizaciones

Para actualizar la aplicación después de hacer push a master:

```bash
cd /opt/jaumina
./deploy.sh
```

### Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f jaumina

# Estado del contenedor
docker compose ps

# Reiniciar
docker compose restart

# Detener
docker compose down

# Ver logs de las últimas 100 líneas
docker compose logs --tail=100 jaumina
```

### Verificación

Después del despliegue, verificar:

1. **La aplicación responde:**
   ```bash
   curl -I https://jaumina.com.py
   ```

2. **El certificado SSL está activo:**
   ```bash
   curl -v https://jaumina.com.py 2>&1 | grep -i ssl
   ```

3. **El menú carga:**
   ```bash
   curl https://jaumina.com.py/m/lamera
   ```

### Estructura de archivos en el servidor

```
/opt/jaumina/
├── .env                 # Variables de entorno (NUNCA commitear)
├── docker-compose.yml   # Configuración de Docker
├── Dockerfile          # Imagen de producción
└── deploy.sh           # Script de despliegue
```

### Troubleshooting

**El contenedor no inicia:**
```bash
docker compose logs jaumina
```

**Puerto 3000 ocupado:**
```bash
lsof -i :3000
# o
docker compose ps
```

**Certificado SSL no se genera:**
- Verificar que Traefik está corriendo
- Verificar que el dominio apunta correctamente al servidor
- Ver logs de Traefik: `docker logs traefik`

**La aplicación no conecta a Supabase:**
- Verificar variables en `.env`
- Verificar que las credenciales son correctas
- Ver logs: `docker compose logs jaumina | grep -i supabase`
