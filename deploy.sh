#!/bin/bash
# Script de despliegue para Ja'umina en VPS Contabo

set -e  # Salir si hay algún error

echo "🚀 Desplegando Ja'umina..."

# 1. Actualizar código
echo "📥 Actualizando código desde git..."
git pull origin master

# 2. Detener contenedor actual
echo "🛑 Deteniendo contenedor actual..."
docker compose down

# 3. Rebuild y levantar
echo "🔨 Construyendo nueva imagen..."
docker compose build --no-cache

echo "▶️  Levantando contenedor..."
docker compose up -d

# 4. Limpiar imágenes antiguas
echo "🧹 Limpiando imágenes antiguas..."
docker image prune -f

echo "✅ Despliegue completado"
echo ""
echo "Ver logs: docker compose logs -f jaumina"
echo "Estado:   docker compose ps"
