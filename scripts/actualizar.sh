#!/bin/bash
set -e

cd /opt/jaumina

echo "📥 Obteniendo últimos cambios..."
git pull origin master

echo "🛑 Deteniendo contenedor..."
docker compose down

echo "🔨 Reconstruyendo imagen..."
docker compose build --no-cache

echo "🚀 Reiniciando contenedor..."
docker compose up -d

echo "🧹 Limpiando imágenes antiguas..."
docker image prune -f

echo ""
echo "✅ Actualización completada"
