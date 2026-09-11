# ============================================================
# Ja'umina - Verificación de Producción
# Ejecutar después del despliegue
# ============================================================

param(
    [string]$url = "https://jaumina.com.py"
)

function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Fail { Write-Host $args -ForegroundColor Red }
function Test-Url { param($url, $nombre)
    Write-Host "  Probando $nombre... " -NoNewline
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Success "✅ OK ($($response.StatusCode))"
            return $true
        } else {
            Write-Fail "❌ Error ($($response.StatusCode))"
            return $false
        }
    } catch {
        Write-Fail "❌ Error ($($_.Exception.Message))"
        return $false
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Verificación de Producción          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Info "🌐 URL base: $url"
Write-Host ""

# Verificaciones
$tests = @(
    @{ url = "$url"; nombre = "Página principal" },
    @{ url = "$url/m/lamera"; nombre = "Menú de La Mera" },
    @{ url = "$url/panel/entrar"; nombre = "Panel de login" }
)

$exitosas = 0
foreach ($test in $tests) {
    if (Test-Url -url $test.url -nombre $test.nombre) {
        $exitosas++
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Resultado: $exitosas/$($tests.Count) pruebas exitosas" -ForegroundColor $(if ($exitosas -eq $tests.Count) { "Green" } else { "Yellow" })
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($exitosas -eq $tests.Count) {
    Write-Success "✅ Ja'umina está funcionando correctamente en producción"
    Write-Info ""
    Write-Info "Próximos pasos:"
    Write-Info "  1. Probar desde un celular con datos móviles"
    Write-Info "  2. Hacer un pedido de prueba completo"
    Write-Info "  3. Verificar el panel de administración"
    Write-Info ""
} else {
    Write-Fail "⚠️  Algunas verificaciones fallaron"
    Write-Info "Revisar logs con: ssh servidor 'cd /opt/jaumina && docker compose logs jaumina'"
}
