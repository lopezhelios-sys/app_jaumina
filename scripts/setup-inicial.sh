#!/bin/bash
set -e

echo "🔍 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi
echo "✅ Docker instalado"

echo "🔍 Verificando Docker Compose..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker Compose no está instalado"
    exit 1
fi
echo "✅ Docker Compose instalado"

echo "🔍 Verificando Traefik..."
if ! docker ps | grep -q traefik; then
    echo "⚠️  Traefik no está corriendo"
    echo "Continuando de todas formas..."
else
    echo "✅ Traefik corriendo"
fi

echo "🌐 Verificando red proxy..."
if ! docker network ls | grep -q proxy; then
    echo "📝 Creando red proxy..."
    docker network create proxy
    echo "✅ Red proxy creada"
else
    echo "✅ Red proxy existe"
fi

echo "📂 Clonando repositorio..."
cd /opt
if [ -d "jaumina" ]; then
    echo "⚠️  Directorio jaumina ya existe"
    cd jaumina
    git pull origin master
else
    git clone __REPO_URL__ jaumina
    cd jaumina
fi
echo "✅ Repositorio listo"

echo "📝 Creando archivo .env..."
cat > .env << 'ENVEOF'
NEXT_PUBLIC_BASE_URL=https://jaumina.com.py
NEXT_PUBLIC_SUPABASE_URL=__SUPABASE_URL__
NEXT_PUBLIC_SUPABASE_ANON_KEY=__SUPABASE_KEY__
ENVEOF

echo "✅ Variables de entorno configuradas"

echo "🔨 Construyendo imagen Docker..."
docker compose build --no-cache

echo "🚀 Iniciando contenedor..."
docker compose up -d

echo ""
echo "✅ Despliegue completado"
echo ""
echo "Verificar en: https://jaumina.com.py"
echo "Ver logs: docker compose logs -f jaumina"
