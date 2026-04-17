# Lista de la Compra PWA

Una Progressive Web App (PWA) completa para gestionar listas de compra. Compatible con el formato de importación/exportación de la app Android.

## Características

- **Pantalla principal con todas las listas** (como la app Android)
- Gestión de múltiples listas de compra
- Productos con nombre, cantidad, precio e imagen
- Marcar productos como comprados/pendientes
- Filtrado por estado (todos, pendientes, comprados)
- **Compartir listas individuales** en JSON (WhatsApp, Email, etc.)
- Importación/Exportación en formato JSON (compatible con la app Android)
- Estadísticas de compras
- Modo oscuro/claro automático
- Diseño mobile-first
- Funciona offline (PWA)
- Gestos táctiles (swipe para acciones rápidas)
- Haptic feedback en dispositivos compatibles

## Instalación

### Opción 1: Servidor local

Usa cualquier servidor HTTP para servir los archivos:

```bash
# Con Python 3
python -m http.server 8080

# Con Node.js (npx)
npx serve -s . -p 8080

# Con PHP
php -S localhost:8080
```

### Opción 2: Despliegue en hosting

Sube los archivos a cualquier hosting estático:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

### Generar iconos

Abre `generate-icons.html` en tu navegador y haz clic en "Generar todos los iconos" para crear los archivos PNG necesarios.

## Uso

### Pantalla Principal (Listas)

La app abre directamente en la pantalla principal donde puedes ver todas tus listas:

1. **Crear una lista**: Escribe el nombre y pulsa el botón +
2. **Abrir una lista**: Toca cualquier tarjeta de lista
3. **Editar lista**: Toca el icono de lápiz en la tarjeta
4. **Eliminar lista**: Toca el icono de papelera en la tarjeta
5. **Compartir lista**: Toca el icono de compartir

### Vista de Productos

Al abrir una lista, verás todos sus productos:

**Añadir productos:**
1. Rellena el formulario superior
2. Nombre (obligatorio)
3. Cantidad (opcional, por defecto 1)
4. Precio (opcional)
5. URL de imagen (opcional)
6. Haz clic en "Añadir producto"

**Marcar como comprado:**
- Toca el checkbox del producto
- O desliza el producto hacia la izquierda

**Editar/Eliminar productos:**
- Toca el icono de lápiz para editar
- Toca el icono de papelera para eliminar
- O desliza hacia la derecha para eliminar

**Volver a listas:**
- Toca el botón "Volver a listas" arriba

### Compartir Listas

**Opción 1: Compartir lista individual**
1. En la pantalla principal, toca el icono de compartir de una lista
2. Elige cómo compartir:
   - **Compartir (WhatsApp, Email...)**: Envía directamente
   - **Descargar JSON**: Guarda el archivo
   - **Copiar al portapapeles**: Para pegar donde quieras

**Opción 2: Exportar todas las listas**
1. Abre el menú lateral (☰)
2. Haz clic en "Exportar todo JSON"
3. Se descargará un archivo con todas tus listas

### Importar Listas

1. Abre el menú lateral (☰)
2. Haz clic en "Importar JSON"
3. Selecciona el archivo JSON recibido
4. La lista se creará automáticamente

## Formato JSON

### Formato de lista individual (para compartir)

```json
{
  "version": 1,
  "exportDate": 1703123456789,
  "listName": "Lista del supermercado",
  "items": [
    {
      "name": "Leche",
      "inShoppingList": true,
      "imageUrl": null,
      "price": 1.20,
      "previousPrice": null,
      "quantity": 2
    }
  ]
}
```

### Formato completo (todas las listas)

```json
{
  "version": 1,
  "exportDate": 1703123456789,
  "lists": [
    {
      "name": "Lista del supermercado",
      "items": [...]
    }
  ]
}
```

## Estadísticas

La app incluye un panel de estadísticas con:
- Total gastado en el periodo seleccionado
- Número de productos comprados
- Precio medio por producto
- Ahorro por reducciones de precio
- Gráfico de gastos temporales
- Productos más comprados

Accede desde cualquier lista pulsando el icono de gráficos.

## Configuración

Abre el menú lateral (☰) para acceder a la configuración:

- **Auto-eliminar comprados**: Elimina automáticamente los productos marcados
- **Confirmar antes de eliminar**: Muestra diálogo de confirmación
- **Respuesta háptica**: Vibración en acciones (Android)

## Sincronización

**Actualmente**: Los datos se guardan localmente en tu dispositivo.

**Para compartir**: Usa el botón de compartir en cada lista.

**¿Quieres sincronización automática entre dispositivos?**
Consulta el archivo `SYNC_OPTIONS.md` para ver las opciones disponibles.

## Tecnologías

- HTML5
- CSS3 (con variables y Grid/Flexbox)
- JavaScript Vanilla (ES6+)
- IndexedDB para almacenamiento local
- Service Worker para funcionalidad offline
- Canvas para gráficos
- Web Share API para compartir

## Compatibilidad

- Navegadores modernos (Chrome, Firefox, Safari, Edge)
- Dispositivos móviles (Android e iOS)
- Funciona offline tras la primera visita

## Licencia

Código abierto para uso personal y comercial.
