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

    Get-Content scripts/verificar-servidor.sh | ssh $destino "bash -s"

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

    # Leer script, reemplazar placeholders, enviar al servidor
    $setupContent = Get-Content scripts/setup-inicial.sh -Raw
    $setupContent = $setupContent.Replace('__REPO_URL__', $repoUrl)
    $setupContent = $setupContent.Replace('__SUPABASE_URL__', $supabaseUrl)
    $setupContent = $setupContent.Replace('__SUPABASE_KEY__', $supabaseKey)

    $setupContent | ssh $destino "cat > /tmp/jaumina-setup.sh && chmod +x /tmp/jaumina-setup.sh && bash /tmp/jaumina-setup.sh"

    if ($LASTEXITCODE -eq 0) {
        Write-Success "`n✅ ¡Despliegue exitoso!"
        Write-Info "`nVerificar en: https://jaumina.com.py"
        Write-Info "Ver logs: ssh $destino"
        Write-Info "  cd /opt/jaumina"
        Write-Info "  docker compose logs -f jaumina"
    } else {
        Write-Fail "`n❌ Error en el despliegue"
        Write-Info "Ver detalles: ssh $destino"
        Write-Info "  cd /opt/jaumina"
        Write-Info "  docker compose logs jaumina"
        exit 1
    }

} else {
    # Actualización: solo rebuild y restart
    Write-Info "`n🔄 Actualizando despliegue existente..."

    Get-Content scripts/actualizar.sh | ssh $destino "bash -s"

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
