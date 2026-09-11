# 🎯 Instrucciones Finales - Despliegue de Ja'umina

## ✅ Todo Está Listo

He creado un sistema de despliegue **completamente automatizado** que podés ejecutar desde tu PC Windows sin necesidad de conectarte manualmente al servidor.

---

## 🚀 Para Desplegar AHORA

### 1️⃣ Abrir PowerShell

```powershell
# Ir al directorio del proyecto
cd c:\Users\Helio\Desktop\app_jaumina
```

### 2️⃣ Ejecutar el Despliegue Automatizado

```powershell
# Reemplazar "TU-IP-AQUI" con la IP de tu servidor Contabo
.\deploy-remoto.ps1 -servidor TU-IP-AQUI -primeraVez
```

**Ejemplo:**
```powershell
.\deploy-remoto.ps1 -servidor 123.45.67.89 -primeraVez
```

### 3️⃣ Esperar 3-5 Minutos

El script automáticamente:
- ✅ Verifica que el servidor tenga Docker
- ✅ Crea la red proxy si no existe
- ✅ Clona el repositorio en `/opt/jaumina`
- ✅ Configura las variables de entorno
- ✅ Construye la imagen Docker
- ✅ Despliega Ja'umina
- ✅ Inicia el contenedor

### 4️⃣ Verificar que Funciona

```powershell
.\verificar-produccion.ps1
```

Deberías ver:
```
✅ OK - Página principal
✅ OK - Menú de La Mera
✅ OK - Panel de login
```

### 5️⃣ Probar desde el Celular

**Importante:** Usar datos móviles, NO wifi

1. Abrir: `https://jaumina.com.py/m/lamera`
2. Hacer un pedido completo
3. Entrar al panel: `https://jaumina.com.py/panel/entrar`

---

## 📝 Requisitos Previos

### En tu PC:
- ✅ Ya tenés PowerShell (viene con Windows)
- ✅ Ya tenés el proyecto clonado
- ⚠️ **Necesitás:** Acceso SSH al servidor sin contraseña

### Configurar SSH (si pide contraseña):

```powershell
# Generar llave SSH (solo primera vez)
ssh-keygen -t ed25519 -C "tu@email.com"

# Copiar llave al servidor
# Cuando pida contraseña, ingresá la contraseña del servidor
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@TU-IP "cat >> ~/.ssh/authorized_keys"

# Probar que funciona sin contraseña
ssh root@TU-IP "echo OK"
# Debe mostrar "OK" sin pedir contraseña
```

---

## 🔄 Actualizaciones Futuras

Cuando hagas cambios en el código:

```powershell
# 1. Guardar y pushear cambios
git add -A
git commit -m "descripción del cambio"
git push

# 2. Desplegar (sin -primeraVez)
.\deploy-remoto.ps1 -servidor TU-IP

# 3. Verificar
.\verificar-produccion.ps1
```

---

## 🛠️ Comandos Útiles

### Ver estado del servidor sin desplegar
```powershell
.\deploy-remoto.ps1 -servidor TU-IP -soloVerificar
```

### Ver logs en tiempo real
```powershell
ssh root@TU-IP "cd /opt/jaumina && docker compose logs -f jaumina"
```

### Reiniciar el servicio
```powershell
ssh root@TU-IP "cd /opt/jaumina && docker compose restart"
```

---

## ❓ ¿Qué Hace Cada Script?

### `deploy-remoto.ps1`
- **Propósito:** Desplegar Ja'umina al servidor desde Windows
- **Cuándo usar:** Primera vez (`-primeraVez`) y actualizaciones
- **Qué hace:** Setup completo o actualización según el flag

### `verificar-produccion.ps1`
- **Propósito:** Verificar que el sitio está funcionando
- **Cuándo usar:** Después de cada despliegue
- **Qué hace:** Prueba las URLs principales desde internet

### `deploy.sh`
- **Propósito:** Script de actualización manual en el servidor
- **Cuándo usar:** Si te conectás por SSH manualmente
- **Qué hace:** Pull, rebuild, restart

---

## 📊 Resumen Visual

```
Tu PC (Windows)
│
├─ deploy-remoto.ps1 -primeraVez
│  │
│  ├─→ SSH al servidor Contabo
│  ├─→ Verifica Docker/Traefik
│  ├─→ Clona repositorio
│  ├─→ Configura .env
│  ├─→ docker compose build
│  └─→ docker compose up -d
│
├─ verificar-produccion.ps1
│  │
│  └─→ Prueba URLs desde internet
│
└─ Tu celular con datos móviles
   │
   └─→ https://jaumina.com.py/m/lamera
```

---

## ✅ Checklist Final

Antes de ejecutar el despliegue:

- [ ] Tengo la IP del servidor Contabo
- [ ] Puedo hacer `ssh root@IP` sin contraseña
- [ ] El dominio `jaumina.com.py` apunta al servidor
- [ ] Docker está instalado en el servidor (el script lo verifica)

Para ejecutar:

- [ ] Abro PowerShell
- [ ] `cd c:\Users\Helio\Desktop\app_jaumina`
- [ ] `.\deploy-remoto.ps1 -servidor MI-IP -primeraVez`
- [ ] Espero 3-5 minutos
- [ ] `.\verificar-produccion.ps1` pasa todas las pruebas
- [ ] Abro desde celular con datos móviles
- [ ] Hago un pedido de prueba completo

---

## 🎉 ¡Listo!

**Con estos comandos tenés todo automatizado:**

```powershell
# Primera vez
.\deploy-remoto.ps1 -servidor TU-IP -primeraVez

# Verificar
.\verificar-produccion.ps1

# Actualizaciones futuras
git push
.\deploy-remoto.ps1 -servidor TU-IP
```

**Ja'umina estará en producción en menos de 5 minutos.**

---

## 📞 Si Algo Falla

1. **Ver qué pasó:**
   ```powershell
   .\deploy-remoto.ps1 -servidor TU-IP -soloVerificar
   ```

2. **Ver logs del contenedor:**
   ```powershell
   ssh root@TU-IP "cd /opt/jaumina && docker compose logs jaumina"
   ```

3. **Reintentar:**
   ```powershell
   .\deploy-remoto.ps1 -servidor TU-IP -primeraVez
   ```

---

**¡Todo listo para producción! 🚀**

Solo ejecutá los comandos y Ja'umina estará online.
