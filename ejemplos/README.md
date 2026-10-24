# Ejemplos de documentos de cliente (para probar el grounding)

Documentos ficticios para probar las opciones `modo` y `formato` sin tener un
archivo real a mano. Están en **formato deliberadamente distinto al nuestro**
para que se note cuando la herramienta lo replica.

## Cómo usarlos en el MCP Inspector

En cualquier herramienta de la Cláusula 4, además del perfil (nombre, sector…),
llena el campo **`documentoClientePath`** con la ruta del ejemplo. El servidor lo
lee y extrae solo (soporta `.docx`, `.txt`, `.md`).

| Ejemplo | Sirve para probar | Herramienta sugerida |
|---|---|---|
| `ejemplos/cliente-partes-interesadas.md` | **formato=cliente** — replica su tabla de 3 columnas y su escala de prioridad 1-3 | `contexto_partes_interesadas_4_2` |
| `ejemplos/cliente-foda-2019.md` | **modo=actualizar** — parte de este FODA viejo (cita ISO 9001:2008, sin FODA cruzado) y lo actualiza a la versión vigente | `contexto_foda_4_1` |

### Prueba 1 — Replicar el formato del cliente (4.2)
- `nombre`: `Textiles del Sur S.A.C.` · `sector`: `Manufactura textil` · `normas`: `9001`, `45001`
- `documentoClientePath`: `ejemplos/cliente-partes-interesadas.md`
- `formato`: `cliente`
- → La salida debe conservar las columnas **GRUPO DE INTERÉS / LO QUE ESPERAN / PRIORIDAD (1-3)**, no la plantilla casa de 6 columnas.

### Prueba 2 — Actualizar un documento vigente (4.1 FODA)
- `nombre`: `Textiles del Sur S.A.C.` · `sector`: `Manufactura textil` · `normas`: `9001`
- `documentoClientePath`: `ejemplos/cliente-foda-2019.md`
- `modo`: `actualizar`
- → Debe conservar lo que sigue válido, corregir la referencia a **ISO 9001:2008 → 2015** y completar lo que falta (p. ej. el FODA cruzado).

> Rutas: relativas a la carpeta del proyecto (el server corre ahí). Si algo falla,
> usa la ruta absoluta: `/ruta/absoluta/del/proyecto/ejemplos/…`

## Ver el entregable en Word (.docx)

Como el Inspector solo muestra texto, para **ver el documento con colores, bordes
y estructura** genera un `.docx`. En `contexto_partes_interesadas_4_2`:

### Prueba 3 — Word con formato casa (nuestro)
- `nombre`: `Textiles del Sur S.A.C.` · `sector`: `Manufactura textil` · `normas`: `9001`, `45001`
- `exportarDocx`: `true`
- → La herramienta escribe el `.docx` en `salidas/` y devuelve su ruta al final del
  resultado. Ábrelo en Word: tablas con encabezado azul y bordes.

### Prueba 4 — Fidelidad visual exacta (plantilla del cliente)
- Los mismos campos de perfil, y:
- `plantillaPath`: `ejemplos/plantilla-partes-interesadas.docx`
- → Rellena **esa** plantilla (encabezado verde del "cliente") conservando su
  estilo, y escribe el `.docx` en `salidas/`. Ábrelo: verás **su** formato, con tus
  datos dentro.

> La plantilla de ejemplo se generó con `npx tsx scripts/gen-plantilla-partes.ts`.
> Para tus formatos reales: toma el .docx del cliente, coloca los marcadores una
> vez (`{empresa}`, y en una fila de tabla `{#partes}{parte}…{prioridad}{/partes}`),
> y pásalo en `plantillaPath`.

### Prueba 5 — Plantilla con la columna del literal c) de ISO 37001:2025
- `nombre`: `Financiera del Altiplano S.A.` · `sector`: `Servicios financieros` · `normas`: `37001`
- `plantillaPath`: `ejemplos/plantilla-antisoborno-partes-interesadas.docx`
- → Rellena una plantilla (ficticia) de sistema de gestión antisoborno con la
  columna **REQUISITOS ABORDADOS MEDIANTE EL SGAS**; cada celda sale del modelo
  (un mecanismo concreto), nunca un «Sí» fijo.

> Generada con `npx tsx scripts/gen-plantilla-antisoborno.ts`. Todos los
> documentos de esta carpeta son **ficticios**; ningún archivo de cliente real
> se versiona (ver `.gitignore`).
