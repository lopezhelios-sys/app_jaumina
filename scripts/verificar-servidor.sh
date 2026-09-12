#!/bin/bash
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
