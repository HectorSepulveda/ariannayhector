# Google Sheets (Accesos + Regalos + Confirmaciones + Fotos)

Este proyecto usa un solo Web App de Google Apps Script para:
- `Parametros`: activa/desactiva funciones del sitio.
- `Invitados`: valida codigo de acceso y registra primer/ultimo ingreso.
- `Regalos`: inventario de regalos y cantidad disponible.
- `Confirmaciones`: RSVP con columnas en espanol.
- `FotosInvitados`: metadatos de las fotos que suben los invitados.

## 1) Preparar Google Sheet
1. Crea una hoja de calculo nueva.
2. Crea la pestana `Parametros` con columnas:
   - `parametro`
   - `valor`
3. Agrega al menos estos parametros:
   - `habilitar_rsvp` -> `true` o `false`
   - `habilitar_codigo_acceso` -> `true` o `false`
   - `habilitar_subida_fotos` -> `true` o `false`
   - `fotos_drive_folder_id` -> ID de la carpeta de Google Drive donde se guardaran las fotos
4. Crea la pestana `Invitados` con columnas:
   - `nombre`
   - `codigo_acceso`
   - `solo` (TRUE/FALSE; si es TRUE, el formulario se mostrara sin opcion de acompanante)
   - `primer_acceso`
   - `ultimo_acceso`
   - `total_accesos`
5. Carga tus invitados con su `codigo_acceso` (las columnas de acceso se completan automatico).
6. Crea la pestana `Regalos` con columnas:
   - `id`
   - `regalo`
   - `descripcion`
   - `precio`
   - `cantidad_disponible`
   - `imagen_url`
   - `link_pago`
   - `activo`
7. Ingresa/edita filas en `Regalos` para administrar inventario, link de pago y disponibilidad desde la misma hoja.
8. No necesitas crear `Confirmaciones`, `ConfirmacionesRegalos` ni `FotosInvitados`; el script las crea con encabezados.

Nota: Si no existe `Parametros`, el sistema usa por defecto:
- `habilitar_rsvp = true`
- `habilitar_codigo_acceso = true`
- `habilitar_subida_fotos = false`

Nota: Si ya tienes hojas antiguas `Gifts`, `RSVP` y/o `Accesos`, el script tambien las reconoce.

## 2) Publicar Apps Script
1. Abre `Extensiones > Apps Script`.
2. Copia el contenido de `apps-script/Code.gs`.
3. `Implementar > Nueva implementacion`.
4. Tipo: `Aplicacion web`.
5. Ejecutar como: `Tu`.
6. Acceso: `Cualquiera`.
7. Implementa y copia la URL del Web App.

## 3) Conectar el sitio
1. En `gift-config.js`, pega la URL:
   - `window.GIFT_API_URL = "TU_URL_WEB_APP";`
2. En `rsvp-config.js`, pega la misma URL:
   - `window.RSVP_API_URL = "TU_URL_WEB_APP";`

## 4) Acceso por codigo
- Al abrir `index.html`, se solicita un codigo.
- El frontend envia `action: "access"` al mismo Web App.
- Si el codigo existe en `Invitados`, se permite ingresar y se registra:
  - `primer_acceso`: solo la primera vez.
  - `ultimo_acceso`: en cada ingreso.
  - `total_accesos`: contador acumulado por invitado.

## 5) Columnas que se guardan en Confirmaciones
- `fecha_registro`
- `enviado_en_iso`
- `asistencia`
- `nombre`
- `correo`
- `con_acompanante`
- `nombre_acompanante`
- `restricciones_alimentarias`
- `otras_restricciones`
- `restricciones_alimentarias_acompanante`
- `otras_restricciones_acompanante`
- `cancion_sugerida`
- `mensaje`

## 6) Columnas que se guardan en FotosInvitados
- `fecha_registro`
- `enviado_en_iso`
- `nombre`
- `comentario`
- `cantidad_fotos`
- `archivo_nombre`
- `archivo_url`
- `archivo_id`
- `tamano_bytes`
- `tipo_mime`
