# ============================================================
# Ja'umina - Despliegue Remoto Automatizado
# Ejecutar desde Windows: .\deploy-remoto.ps1
# ============================================================

param(
    [string]$servidor = "",
    [string]$usuario = "root",
    [switch]$primeraVez = $false,
    [switch]$soloVerificar = $false
)

# Colores para output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Fail { Write-Host $args -ForegroundColor Red }

# Banner
Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Ja'umina - Despliegue Automatizado   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Validar parámetros
if ($servidor -eq "") {
    Write-Fail "❌ Error: Debes especificar el servidor"
    Write-Info ""
    Write-Info "Uso:"
    Write-Info "  .\deploy-remoto.ps1 -servidor tu-servidor-ip"
    Write-Info "  .\deploy-remoto.ps1 -servidor tu-servidor-ip -primeraVez"
    Write-Info "  .\deploy-remoto.ps1 -servidor tu-servidor-ip -soloVerificar"
    Write-Info ""
    exit 1
}

$destino = "$usuario@$servidor"

# Verificar conectividad SSH
Write-Info "🔍 Verificando conexión SSH a $destino..."
$testSSH = ssh -o ConnectTimeout=5 -o BatchMode=yes $destino "echo OK" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "❌ No se pudo conectar al servidor"
    Write-Warning "Verifica:"
    Write-Warning "  - La IP del servidor es correcta"
    Write-Warning "  - Tenés acceso SSH configurado"
    Write-Warning "  - El firewall permite conexiones SSH"
    exit 1
}
Write-Success "✅ Conexión SSH exitosa"

# Leer variables de entorno locales
Write-Info "📝 Leyendo variables de entorno..."
if (-not (Test-Path ".env.local")) {
    Write-Fail "❌ No se encontró .env.local"
    exit 1
}

$envVars = Get-Content .env.local | Where-Object { $_ -match '^[^#]' }
$supabaseUrl = ($envVars | Where-Object { $_ -match 'NEXT_PUBLIC_SUPABASE_URL' }) -replace '.*=', ''
$supabaseKey = ($envVars | Where-Object { $_ -match 'NEXT_PUBLIC_SUPABASE_ANON_KEY' }) -replace '.*=', ''

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Fail "❌ Faltan variables de Supabase en .env.local"
    exit 1
}

# Solo verificar
if ($soloVerificar) {
    Write-Info "🔍 Verificando estado del servidor..."

    ssh $destino @'
        echo "📦 Contenedores en ejecución:"
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

        echo ""
        echo "🌐 Redes Docker:"
        docker network ls | grep proxy || echo "  ⚠️  Red 'proxy' no existe"

        echo ""
        echo "📂 Proyecto Ja'umina:"
        if [ -d "/opt/jaumina" ]; then
            echo "  ✅ Directorio existe"
            cd /opt/jaumina && git log --oneline -1
        else
            echo "  ⚠️  Directorio no existe"
        fi
'@

    Write-Success "`n✅ Verificación completada"
    exit 0
}

# Primera vez: setup completo
if ($primeraVez) {
    Write-Info "`n🚀 Primera instalación - Setup completo"
    Write-Warning "Esto va a:"
    Write-Warning "  1. Verificar requisitos (Docker, Traefik)"
    Write-Warning "  2. Crear red proxy si no existe"
    Write-Warning "  3. Clonar el repositorio"
    Write-Warning "  4. Configurar variables de entorno"
    Write-Warning "  5. Desplegar Ja'umina"
    Write-Host ""

    $confirm = Read-Host "¿Continuar? (s/n)"
    if ($confirm -ne "s") {
        Write-Warning "Cancelado"
        exit 0
    }

    Write-Info "`n📋 Obteniendo URL del repositorio..."
    $repoUrl = git config --get remote.origin.url
    if (-not $repoUrl) {
        Write-Fail "❌ No se pudo obtener la URL del repositorio"
        Write-Info "Ejecutá: git remote -v"
        exit 1
    }
    Write-Success "  Repositorio: $repoUrl"

    Write-Info "`n🔧 Ejecutando setup en el servidor..."

    $setupScript = @"
#!/bin/bash
set -e

echo '🔍 Verificando Docker...'
if ! command -v docker &> /dev/null; then
    echo '❌ Docker no está instalado'
    exit 1
fi
echo '✅ Docker instalado'

echo '🔍 Verificando Docker Compose...'
if ! command -v docker compose &> /dev/null; then
    echo '❌ Docker Compose no está instalado'
    exit 1
fi
echo '✅ Docker Compose instalado'

echo '🔍 Verificando Traefik...'
if ! docker ps | grep -q traefik; then
    echo '⚠️  Traefik no está corriendo'
    echo 'Continuando de todas formas...'
else
    echo '✅ Traefik corriendo'
fi

echo '🌐 Verificando red proxy...'
if ! docker network ls | grep -q proxy; then
    echo '📝 Creando red proxy...'
    docker network create proxy
    echo '✅ Red proxy creada'
else
    echo '✅ Red proxy existe'
fi

echo '📂 Clonando repositorio...'
cd /opt
if [ -d "jaumina" ]; then
    echo '⚠️  Directorio jaumina ya existe'
    cd jaumina
    git pull origin master
else
    git clone $repoUrl jaumina
    cd jaumina
fi
echo '✅ Repositorio listo'

echo '📝 Creando archivo .env...'
cat > .env << 'ENVEOF'
NEXT_PUBLIC_BASE_URL=https://jaumina.com.py
NEXT_PUBLIC_SUPABASE_URL=$supabaseUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabaseKey
ENVEOF

echo '✅ Variables de entorno configuradas'

echo '🔨 Construyendo imagen Docker...'
docker compose build --no-cache

echo '🚀 Iniciando contenedor...'
docker compose up -d

echo ''
echo '✅ Despliegue completado'
echo ''
echo 'Verificar en: https://jaumina.com.py'
echo 'Ver logs: docker compose logs -f jaumina'
"@

    $setupScript | ssh $destino "cat > /tmp/jaumina-setup.sh && chmod +x /tmp/jaumina-setup.sh && bash /tmp/jaumina-setup.sh"

    if ($LASTEXITCODE -eq 0) {
        Write-Success "`n✅ ¡Despliegue exitoso!"
        Write-Info "`nVerificar en: https://jaumina.com.py"
        Write-Info "Ver logs: ssh $destino 'cd /opt/jaumina && docker compose logs -f jaumina'"
    } else {
        Write-Fail "`n❌ Error en el despliegue"
        Write-Info "Ver detalles: ssh $destino 'cd /opt/jaumina && docker compose logs jaumina'"
        exit 1
    }

} else {
    # Actualización: solo rebuild y restart
    Write-Info "`n🔄 Actualizando despliegue existente..."

    $updateScript = @"
#!/bin/bash
set -e

cd /opt/jaumina

echo '📥 Obteniendo últimos cambios...'
git pull origin master

echo '🛑 Deteniendo contenedor...'
docker compose down

echo '🔨 Reconstruyendo imagen...'
docker compose build --no-cache

echo '🚀 Reiniciando contenedor...'
docker compose up -d

echo '🧹 Limpiando imágenes antiguas...'
docker image prune -f

echo ''
echo '✅ Actualización completada'
"@

    $updateScript | ssh $destino "bash -s"

    if ($LASTEXITCODE -eq 0) {
        Write-Success "`n✅ ¡Actualización exitosa!"
    } else {
        Write-Fail "`n❌ Error en la actualización"
        exit 1
    }
}

Write-Host ""
Write-Success "════════════════════════════════════════"
Write-Success "  Despliegue completado exitosamente"
Write-Success "════════════════════════════════════════"
Write-Host ""
