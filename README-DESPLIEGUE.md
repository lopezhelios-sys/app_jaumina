# 🚀 Despliegue Automatizado de Ja'umina

## Requisitos Previos

1. **En tu PC Windows:**
   - Git Bash o PowerShell
   - Acceso SSH al servidor (sin contraseña, usando llaves SSH)

2. **En el servidor Contabo:**
   - Docker instalado
   - Docker Compose instalado
   - Traefik corriendo (opcional pero recomendado)
   - Dominio `jaumina.com.py` apuntando al servidor

---

## 🎯 Despliegue en 3 Pasos

### Paso 1: Primera vez (solo una vez)

```powershell
# Desde Windows PowerShell
.\deploy-remoto.ps1 -servidor TU-IP-SERVIDOR -primeraVez
```

Este comando:
- ✅ Verifica Docker y Traefik
- ✅ Crea la red proxy si no existe
- ✅ Clona el repositorio en el servidor
- ✅ Configura variables de entorno automáticamente
- ✅ Construye y despliega Ja'umina

**Tiempo estimado:** 3-5 minutos

---

### Paso 2: Verificar que funciona

```powershell
.\verificar-produccion.ps1
```

Este comando verifica desde tu PC que:
- ✅ La página principal carga
- ✅ El menú está accesible
- ✅ El panel de login funciona

---

### Paso 3: Verificar desde celular

**Importante:** Usar datos móviles, NO wifi

1. Abrir: `https://jaumina.com.py/m/lamera`
2. Hacer un pedido completo
3. Verificar que todo funciona

---

## 🔄 Actualizaciones Futuras

Cuando hagas cambios en el código:

```powershell
# 1. Commitear y pushear cambios
git add -A
git commit -m "descripción"
git push

# 2. Desplegar automáticamente
.\deploy-remoto.ps1 -servidor TU-IP-SERVIDOR

# 3. Verificar
.\verificar-produccion.ps1
```

**Tiempo estimado:** 2-3 minutos

---

## 🔍 Comandos Útiles

### Ver estado del servidor

```powershell
.\deploy-remoto.ps1 -servidor TU-IP-SERVIDOR -soloVerificar
```

Muestra:
- Contenedores corriendo
- Redes disponibles
- Estado del proyecto

### Ver logs en tiempo real

```powershell
ssh root@TU-IP-SERVIDOR
cd /opt/jaumina
docker compose logs -f jaumina
```

Presiona `Ctrl+C` para salir

### Reiniciar el servicio

```powershell
ssh root@TU-IP-SERVIDOR "cd /opt/jaumina && docker compose restart"
```

### Detener el servicio

```powershell
ssh root@TU-IP-SERVIDOR "cd /opt/jaumina && docker compose down"
```

### Iniciar el servicio

```powershell
ssh root@TU-IP-SERVIDOR "cd /opt/jaumina && docker compose up -d"
```

---

## ❌ Troubleshooting

### "No se pudo conectar al servidor"

**Problema:** SSH no funciona

**Solución:**
```powershell
# Probar conexión manual
ssh root@TU-IP-SERVIDOR

# Si pide contraseña, configurar llave SSH:
ssh-keygen
ssh-copy-id root@TU-IP-SERVIDOR
```

### "Red proxy no existe"

**Problema:** Traefik no está configurado

**Solución:**
```powershell
ssh root@TU-IP-SERVIDOR "docker network create proxy"
```

### "Puerto 3000 ocupado"

**Problema:** Otro servicio usa el puerto

**Solución:** El script ya NO expone el puerto 3000 públicamente, solo internamente. No debería haber conflicto.

### "Certificado SSL no se genera"

**Problema:** Traefik no puede obtener el certificado

**Verificar:**
1. Dominio apunta correctamente: `nslookup jaumina.com.py`
2. Traefik está corriendo: `ssh root@servidor "docker ps | grep traefik"`
3. Puerto 80 y 443 abiertos en firewall

---

## 📋 Checklist de Verificación

Después del primer despliegue:

- [ ] `.\deploy-remoto.ps1 -servidor IP -primeraVez` ejecutó sin errores
- [ ] `.\verificar-produccion.ps1` pasó todas las pruebas
- [ ] Página abre en el navegador con HTTPS (candado verde)
- [ ] Menú carga desde celular con datos móviles
- [ ] Se puede hacer un pedido completo
- [ ] Panel de administración accesible
- [ ] Login funciona
- [ ] Viajes se pueden crear y abrir

**Cuando todo ✅ → Ja'umina está en producción**

---

## 🎯 Resumen Ejecutivo

**Primera vez:**
```powershell
.\deploy-remoto.ps1 -servidor TU-IP -primeraVez
.\verificar-produccion.ps1
```

**Actualizaciones:**
```powershell
git push
.\deploy-remoto.ps1 -servidor TU-IP
```

**Verificar estado:**
```powershell
.\deploy-remoto.ps1 -servidor TU-IP -soloVerificar
```

---

**¡Listo para producción! 🚀**
