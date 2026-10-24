# Carpeta `normas/` — referencia normativa por requisito

Cada herramienta carga aquí **lo que exige el requisito** que produce y lo inyecta
en el prompt para **ceñir la salida a la norma y no hacer de más**.

## Cómo se cargan los archivos

Al generar un entregable del requisito `<codigo>` (ej. `4.2`) para las normas
objetivo del perfil, el servidor busca el **primer** archivo que exista por
extensión (`.md`, `.txt`, `.docx`):

```
normas/<norma>/<codigo>.md    → texto oficial de esa norma (9001, 14001, 45001, 37001)
normas/comun/<codigo>.md      → guía del Anexo SL, común (paráfrasis), usada solo si
                                no hay texto oficial para ninguna norma objetivo
```

Si existe al menos un archivo oficial para las normas pedidas, **ese texto
prevalece** y la guía común no se mezcla. Si no hay ningún archivo, la
herramienta funciona igual (sin referencia).

## Qué hay en el repositorio y qué pones tú

- `comun/4.1.md … 4.4.md` → **guías internas (paráfrasis)** de qué pide cada
  requisito. No son el texto oficial ISO.
- `9001/`, `14001/`, `45001/`, `37001/` → solo un `NOTA.md`. **El texto oficial
  de las normas ISO tiene derechos de autor y no se versiona ni se publica.**
  Si tienes licencia, deja aquí el texto de cada requisito, un archivo por
  código (`4.1.md`, `4.2.md`, …); `.gitignore` los excluye automáticamente.
  Puedes pegar `.md`/`.txt` o dejar el `.docx` (se extrae solo).
- Los tests no dependen de estos archivos: usan fixtures sintéticos en
  `test/fixtures/normas/`.

## Convención de códigos
Usa el número del requisito tal cual la norma: `4.1`, `4.2`, `4.3`, `4.4`,
`4.5` (solo 37001), `5.2`, `6.1`, `7.5`, `8.1`, `9.2`, `10.2`, …

> El código que cada herramienta busca está declarado en su `HerramientaSpec`
> (`codigo`). Al añadir cláusulas nuevas, crea el archivo con ese mismo código.
