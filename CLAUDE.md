# CLAUDE.md - Lista de la Compra PWA

## Información del Proyecto

**Nombre**: Lista de la Compra PWA
**Tipo**: Progressive Web App (PWA)
**Tecnologías**: HTML5, CSS3, JavaScript Vanilla, IndexedDB, Service Worker
**Estado**: Activo en desarrollo

## Descripción

PWA completa para gestionar listas de compra. Permite crear múltiples listas, añadir productos con nombre, cantidad, precio e imagen, marcar productos como comprados, ver estadísticas y funciona offline. Es compatible con el formato JSON de la app Android original para importar/exportar listas.

---

# REGLA DE ORO ⚠️

## NO TOCAR LO QUE FUNCIONA

Antes de modificar cualquier código existente, pregúntate:
1. ¿Está roto? Si NO → NO LO TOQUES
2. ¿Hay un bug reportado? Si NO → NO LO TOQUES
3. ¿El usuario lo ha pedido explícitamente? Si NO → NO LO TOQUES

**El código que funciona es sagrado.** Refactorizar por gustos personales, "limpieza" o "preferencias" está PROHIBIDO a menos que el usuario lo solicite.

---

# Normas y Reglas de Desarrollo

## 1. Estructura de Archivos

```
lista-de-la-compra/
├── index.html          # Estructura HTML principal
├── styles.css          # TODOS los estilos
├── app.js              # TODA la lógica JavaScript
├── sw.js               # Service Worker (NO MODIFICAR sin razón)
├── manifest.json       # Manifest PWA (respetar formato)
├── icon.svg            # Icono vectorial
├── generate-icons.html # Utilidad para generar PNGs
├── CLAUDE.md           # Este archivo
├── README.md           # Documentación para usuarios
├── .htaccess           # Configuración Apache
└── package.json        # Scripts npm
```

**REGLA**: NO crear archivos innecesarios. NO separar CSS/JS en múltiples archivos a menos que sea estrictamente necesario.

## 2. Convenciones de Código

### JavaScript
- Usar `const` y `let`, NUNCA `var`
- Usar arrow functions para callbacks
- Nombres de funciones en camelCase: `renderItems()`
- Nombres de constantes en UPPER_SNAKE_CASE: `DB_NAME`
- Espaciado: 2 espacios, NO tabulaciones
- Punto y coma: SÍ usar siempre

### CSS
- Usar variables CSS para colores y espaciados
- Nombres de clases en kebab-case: `.item-checkbox`
- BEM naming para componentes complejos: `.block__element--modifier`
- Mobile-first: escribir estilos base para móvil, luego media queries

### HTML
- Usar elementos semánticos (`<main>`, `<header>`, `<section>`)
- Atributos `aria-label` en botones con iconos
- Atributos `alt` en imágenes (aunque sea vacío si es decorativo)

## 3. Gestión de Estado

**REGLA**: Toda la gestión de estado pasa a través de `appState`.

```javascript
let appState = {
    currentListId: null,
    currentFilter: 'all',
    lists: [],
    items: [],
    settings: {},
    history: [],
    db: null
};
```

- NO usar variables globales fuera de `appState`
- NO almacenar estado en el DOM (leer de `appState`, no del DOM)
- SIEMPRE actualizar `appState` antes de renderizar

## 4. Operaciones de Base de Datos (IndexedDB)

**REGLA**: Toda operación con IndexedDB va a través del objeto `db`.

```javascript
db.getAll(), db.get(), db.add(), db.put(), db.delete()
```

- NUNCA acceder a IndexedDB directamente fuera de `db.js` (aquí está en `app.js`)
- SIEMPRER esperar a que `db.open()` se complete antes de cualquier operación
- Manejar SIEMPRE los errores de IndexedDB

## 5. Renderizado

**REGLA**: El renderizado se hace a través de funciones del objeto `ui`.

```javascript
ui.renderLists(), ui.renderItems(), ui.updateHeader()
```

- NO manipular el DOM directamente fuera de `ui.*`
- Los templates HTML usan template literals con escape de HTML
- SIEMPRE escapar contenido del usuario con `utils.escapeHtml()`

## 6. Importación/Exportación JSON

**CRÍTICO**: El formato JSON DEBE ser compatible con la app Android.

```json
{
  "version": 1,
  "exportDate": 1703123456789,
  "lists": [
    {
      "name": "Nombre lista",
      "items": [
        {
          "name": "Producto",
          "inShoppingList": true,
          "imageUrl": null,
          "price": 1.20,
          "previousPrice": null,
          "quantity": 1
        }
      ]
    }
  ]
}
```

- NO cambiar los nombres de las propiedades
- NO cambiar la estructura anidada
- MANTENER compatibilidad con versiones anteriores

## 7. Estilos y Tema

**REGLA**: Usar variables CSS para todo.

```css
--bg-primary, --bg-secondary, --text-primary, --primary, etc.
```

- NO usar colores harcodeados
- El tema oscuro se activa con `[data-theme="dark"]` en `<html>`
- Respetar las transiciones existentes

## 8. Event Listeners

**REGLA**: Todos los event listeners se registran en `setupEventListeners()`.

- NO agregar event listeners fuera de esta función
- Los event listeners para elementos dinámicos se agregan al renderizar
- SIEMPRE hacer cleanup de event listeners cuando sea necesario

## 9. Seguridad

**CRÍTICO**: Todo contenido del usuario DEBE ser escapado.

```javascript
utils.escapeHtml(texto)
```

- NO confiar en `innerHTML` con contenido del usuario
- NO usar `eval()` bajo ninguna circunstancia
- Sanitizar URLs antes de usarlas en atributos href/src

## 10. Testing y Debugging

- SIEMPRO probar en múltiples navegadores (Chrome, Firefox, Safari)
- SIEMPRE probar en dispositivos móviles reales
- Usar DevTools para verificar IndexedDB
- Usar Lighthouse para auditar PWA

## 11. Performance

- Lazy loading de imágenes: `loading="lazy"`
- Debounce para eventos de scroll/resize
- NO cargar librerías externas si no son necesarias
- Mantener el bundle bajo 100KB (sin iconos)

## 12. Accesibilidad

- TODOS los botones con iconos necesitan `aria-label`
- Contraste de colores mínimo AA (4.5:1)
- Navegación por teclado funcional
- `:focus-visible` para indicadores de foco

## 13. PWA Best Practices

- El Service Worker debe interceptar TODAS las peticiones navegables
- Manifest debe tener todos los tamaños de icono
- `start_url` debe funcionar offline
- Probar `installability` en Lighthouse

## 14. Compatibilidad con App Android

**MÁXIMA PRIORIDAD**: Mantener compatibilidad con el formato JSON de la app Android en:
- `D:\AndroidStudioProjects\Listadelacompra`
- `D:\AndroidStudioProjects\Listadelacompra_backend`

Estructura de datos que DEBE mantenerse:

```javascript
// ShoppingItem (artículo)
{
    id: string,
    name: string,
    inShoppingList: boolean,  // true = pendiente, false = comprado
    listId: string,
    imageUrl: string | null,
    price: number | null,
    previousPrice: number | null,
    quantity: number,
    createdAt: number (timestamp)
}

// ShoppingList (lista)
{
    id: string,
    name: string,
    createdAt: number,
    updatedAt: number
}
```

## 15. Prohibido

- ❌ Añadir frameworks (React, Vue, Angular, etc.)
- ❌ Añadir build tools (Webpack, Vite, etc.) sin motivo
- ❌ Separar en múltiples archivos JS/CSS sin motivo
- ❌ Cambiar el esquema de IndexedDB
- ❌ Eliminar funcionalidades existentes
- ❌ Cambiar el formato de importación/exportación JSON
- ❌ Quitar soporte offline
- ❌ Eliminar el modo oscuro

## 16. Antes de hacer cambios

1. Leer el código existente completo
2. Entender la arquitectura
3. Verificar que el cambio no rompe nada
4. Testear después del cambio
5. Commit con mensaje claro

## 17. Mensajes de Commit

Usar formato convencional:

```
feat: añadir nueva funcionalidad
fix: corregir bug en XYZ
docs: actualizar README
style: formatear código (NO REFACTOR)
refactor: reestructurar código (MANTENIENDO funcionalidad)
test: añadir tests
chore: tareas de mantenimiento
```

## 18. Debugging Común

### IndexedDB no guarda datos
- Verificar que `db.open()` se completó
- Verificar permisos del navegador
- Revisar DevTools > Application > IndexedDB

### Service Worker no actualiza
- DevTools > Application > Service Workers > Update on reload
- O cambiar `CACHE_NAME` en `sw.js`

### Iconos no aparecen
- Verificar que los archivos PNG existen
- Verificar rutas en `manifest.json`
- Limpiar cache del navegador

## 19. Comandos Útiles

```bash
# Iniciar servidor local
python -m http.server 8080
# o
npx serve -s . -p 8080

# Auditoría PWA
npx lighthouse http://localhost:8080 --view

# Limpiar cache de navegador
# DevTools > Application > Clear storage > Clear site data
```

## 20. Contacto y Soporte

- Revisar `README.md` para documentación de usuario
- Para bugs: reproducir paso a paso antes de reportar
- Para nuevas funcionalidades: preguntar antes de implementar

---

**Última actualización**: Abril 2026
**Versión**: 1.0.0
