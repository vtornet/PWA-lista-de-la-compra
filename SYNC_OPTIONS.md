# Opciones de Sincronización

## Situación Actual

La PWA actual almacena todos los datos **localmente** en el navegador usando IndexedDB. Esto significa:
- ✅ Los datos son privados y están en tu dispositivo
- ✅ Funciona completamente sin internet
- ❌ Los cambios NO se sincronizan automáticamente entre dispositivos/usuarios

## Cómo compartir listas actualmente

### Método 1: Compartir lista individual (NUEVO)

1. En la vista principal, mantén pulsado el botón de compartir de una lista
2. Elige:
   - **Compartir (WhatsApp, Email...)**: Envía el JSON directamente
   - **Descargar JSON**: Guarda el archivo en tu dispositivo
   - **Copiar al portapapeles**: Pega donde quieras

### Método 2: Exportar todo

1. Menú → Configuración → Exportar todo JSON
2. Envía el archivo a otra persona

### Método 3: Importar lista recibida

1. Menú → Configuración → Importar JSON
2. Selecciona el archivo recibido
3. La lista se creará automáticamente

---

## Opciones de Sincronización Automática

Para que los cambios se sincronicen **automáticamente** entre usuarios, necesitas un backend/servidor. Aquí tienes las opciones:

### Opción 1: Backend en la Nube (Recomendado)

**Qué necesitas:**
- Un servidor con base de datos (Firebase, Supabase, o backend propio)

**Cómo funciona:**
```
Usuario A ──┐
            ├──→ Servidor ──→ Base de Datos
Usuario B ──┘                ↓
                         Usuario A y B ven los cambios
```

**Servicios recomendados:**

| Servicio | Coste | Complejidad | Tiempo implementación |
|----------|-------|-------------|----------------------|
| **Firebase** | Gratis hasta cierto límite | Media | 2-3 días |
| **Supabase** | Generoso plan gratuito | Media | 2-3 días |
| **Railway + FastAPI** | ~$5/mes | Alta | 5-7 días |
| **Propio (VPS)** | $3-5/mes | Muy alta | 10+ días |

**Ventajas:**
- ✅ Sincronización en tiempo real
- ✅ Múltiples usuarios simultáneos
- ✅ Historial de cambios
- ✅ Acceso desde cualquier dispositivo

**Desventajas:**
- ❌ Requiere internet para sincronizar
- ❌ Coste mensual (aunque puede ser mínimo)
- ❌ Más complejidad técnica

### Opción 2: WebRTC (P2P directo)

**Qué necesitas:**
- Un servidor de signaling (muy ligero)

**Cómo funciona:**
```
Usuario A ←──→ Servidor de Signaling ←──→ Usuario B
              (solo para conectar)
Usuario A ←──────────────────────→ Usuario B
           (datos directos P2P)
```

**Ventajas:**
- ✅ Los datos van directamente entre usuarios
- ✅ Servidor mínimo y barato
- ✅ Privado (datos sin servidor central)

**Desventajas:**
- ❌ Ambos usuarios deben estar online al mismo tiempo
- ❌ Más complejo de implementar
- ❌ No funciona si uno está offline

### Opción 3: Sincronización periódica con archivos

**Qué necesitas:**
- Google Drive, Dropbox, o similar

**Cómo funciona:**
- La app guarda automáticamente en Drive/Dropbox
- Cada usuario importa los cambios periódicamente

**Ventajas:**
- ✅ Fácil de implementar
- ✅ Gratis con servicios existentes
- ✅ El usuario controla cuándo sincronizar

**Desventajas:**
- ❌ No es automático
- ❌ Pueden haber conflictos si ambos editan

---

## Recomendación

**Para uso personal/familiar:**
- Usa el sistema actual (compartir JSON)
- Es simple, gratuito y funciona

**Para sincronización real:**
- **Opción rápida**: Implementa Firebase (2-3 días de desarrollo)
- **Opción gratuita**: Supabase (similar a Firebase)
- **Si ya tienes backend Android**: Reutiliza tu backend existente en FastAPI

---

## ¿Quieres que implemente sincronización?

Si decides que necesitas sincronización automática, puedo ayudarte a:

1. **Integrar Firebase** (más rápido de implementar)
2. **Conectar con tu backend Android existente** (reutilizar código)
3. **Implementar WebRTC** (si prefieres P2P)

Dime qué opción prefieres y comenzaré la implementación.
