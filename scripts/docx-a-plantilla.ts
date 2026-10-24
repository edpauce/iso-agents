/**
 * Convierte un .docx REAL del cliente en una PLANTILLA docxtemplater,
 * preservando su XML: estilos, colores, fuentes, encabezado/pie, banners y
 * cualquier otra tabla. Es el paso de "preparar la plantilla una vez".
 *
 * Toma la tabla indicada, conserva su fila de encabezado, usa la primera fila de
 * datos como PROTOTIPO de estilo, y la reescribe con los marcadores del bucle;
 * el resto de filas de datos se eliminan (docxtemplater las regenerará).
 *
 *   npx tsx scripts/docx-a-plantilla.ts <origen.docx> <destino.docx> <indiceTabla> <filas> <tag1,tag2,...>
 *
 * `filas` = lista de `indiceFila:bucle`. Se admite MÁS DE UNA fila prototipo
 * cuando el cliente usa formato condicional por fila (p. ej. filas internas en
 * celeste y externas en salmón): cada prototipo conserva SU propio estilo y se
 * repite con su propio bucle. docxtemplater no sabe cambiar el sombreado de una
 * celda según los datos, así que ésta es la forma de conservar esos colores.
 *
 * Ej. (documento de un cliente: fila 1 = INTERNO celeste, fila 6 = EXTERNO salmón):
 *   npx tsx scripts/docx-a-plantilla.ts "cliente.docx" "plantilla.docx" 1 1:internas,6:externas ambito,parte,requisitos,necesidades
 */
import { readFile, writeFile } from "node:fs/promises";
import PizZip from "pizzip";

const [, , origen, destino, idxTablaRaw, filasRaw, tagsRaw, extraRaw] = process.argv;
if (!origen || !destino || !idxTablaRaw || !filasRaw || !tagsRaw) {
  console.error(
    "Uso: tsx scripts/docx-a-plantilla.ts <origen.docx> <destino.docx> <indiceTabla> <indiceFila:bucle[,...]> <tag1,tag2,...> [\"ENCABEZADO::tag\"]"
  );
  process.exit(1);
}
const idxTabla = Number(idxTablaRaw);
const tags = tagsRaw.split(",").map((t) => t.trim());
/** Columna NUEVA a añadir (hereda el estilo de la última columna). */
const extra = extraRaw
  ? (() => {
      const [encabezado, tag] = extraRaw.split("::");
      if (!encabezado || !tag) throw new Error('Columna extra: usa "ENCABEZADO::tag"');
      return { encabezado, tag };
    })()
  : null;
const prototipos = filasRaw.split(",").map((par) => {
  const [idx, bucle] = par.split(":");
  if (!idx || !bucle) throw new Error(`Formato inválido en '${par}'. Usa indiceFila:bucle`);
  return { idx: Number(idx), bucle };
});

const RE_TBL = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
const RE_TR = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
const RE_TC = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;

/** Partes reutilizables de una celda: apertura, propiedades y estilos. */
function anatomia(tc: string) {
  const tcPr = /<w:tcPr>[\s\S]*?<\/w:tcPr>/.exec(tc)?.[0] ?? "";
  const primerP = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/.exec(tc)?.[0] ?? "";
  const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(primerP)?.[0] ?? "";
  const rPr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(primerP)?.[0] ?? "";
  const abre = /^<w:tc(?:\s[^>]*)?>/.exec(tc)?.[0] ?? "<w:tc>";
  return { tcPr, pPr, rPr, abre };
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Reescribe una celda para que su ÚNICO contenido sea `texto`, conservando
 *  las propiedades de celda (tcPr), de párrafo (pPr) y de run (rPr). */
function celdaConTexto(tc: string, texto: string): string {
  const { tcPr, pPr, rPr, abre } = anatomia(tc);
  const p = `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(texto)}</w:t></w:r></w:p>`;
  return `${abre}${tcPr}${p}</w:tc>`;
}

/**
 * Celda de LISTA: un bucle de párrafo que repite el párrafo del prototipo (con
 * su viñeta/numeración heredada) una vez por elemento del arreglo.
 *
 * docxtemplater elimina los párrafos que sólo contienen la etiqueta del bucle y
 * repite los de en medio, así que las viñetas del cliente se conservan en vez de
 * aplastarse en un único párrafo.
 */
function celdaLista(tc: string, bucle: string, abrirFila?: string, cerrarFila?: string): string {
  const { tcPr, pPr, rPr, abre } = anatomia(tc);
  const pSolo = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  const item = `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">{.}</w:t></w:r></w:p>`;
  const cuerpo = `${pSolo(`{#${bucle}}`)}${item}${pSolo(`{/${bucle}}`)}`;
  const antes = abrirFila ? pSolo(abrirFila) : "";
  const despues = cerrarFila ? pSolo(cerrarFila) : "";
  return `${abre}${tcPr}${antes}${cuerpo}${despues}</w:tc>`;
}

const buf = await readFile(origen);
const zip = new PizZip(buf);
const docXml = zip.file("word/document.xml")?.asText();
if (!docXml) throw new Error("El .docx no contiene word/document.xml");

const tablas = docXml.match(RE_TBL) ?? [];
if (!tablas[idxTabla]) throw new Error(`No existe la tabla ${idxTabla} (hay ${tablas.length}).`);

const tabla = tablas[idxTabla];
const filas = tabla.match(RE_TR) ?? [];
if (filas.length < 2) throw new Error("La tabla necesita al menos encabezado + una fila de datos.");

/** Encabezado, opcionalmente con una columna nueva clonada de la última celda. */
function encabezadoConExtra(): string {
  const fila = filas[0];
  if (!extra) return fila;
  const celdas = fila.match(RE_TC) ?? [];
  const nueva = celdaConTexto(celdas[celdas.length - 1], extra.encabezado);
  return fila.replace(/<\/w:tr>$/, `${nueva}</w:tr>`);
}

/** Convierte una fila real en fila-plantilla del bucle, conservando su estilo. */
function filaPlantillaDe(idxFila: number, bucle: string): string {
  const prototipo = filas[idxFila];
  if (!prototipo) throw new Error(`No existe la fila ${idxFila} (hay ${filas.length}).`);
  const celdas = prototipo.match(RE_TC) ?? [];
  if (celdas.length !== tags.length) {
    throw new Error(
      `La fila ${idxFila} tiene ${celdas.length} celdas pero se pasaron ${tags.length} marcadores (${tags.join(", ")}).`
    );
  }
  const total = celdas.length + (extra ? 1 : 0);
  // {#bucle} abre en la 1ª celda y {/bucle} cierra en la última (la extra, si la hay).
  const nuevasCeldas = celdas.map((tc, i) => {
    const esLista = tags[i].startsWith("lista:");
    const nombre = esLista ? tags[i].slice("lista:".length) : tags[i];
    const abrir = i === 0 ? `{#${bucle}}` : undefined;
    const cerrar = !extra && i === total - 1 ? `{/${bucle}}` : undefined;
    if (esLista) return celdaLista(tc, nombre, abrir, cerrar);
    return celdaConTexto(tc, `${abrir ?? ""}{${nombre}}${cerrar ?? ""}`);
  });
  if (extra) {
    const ultima = celdas[celdas.length - 1];
    nuevasCeldas.push(celdaConTexto(ultima, `{${extra.tag}}{/${bucle}}`));
  }
  const abreTr = /^<w:tr(?:\s[^>]*)?>/.exec(prototipo)?.[0] ?? "<w:tr>";
  const trPr = /<w:trPr>[\s\S]*?<\/w:trPr>/.exec(prototipo)?.[0] ?? "";
  return `${abreTr}${trPr}${nuevasCeldas.join("")}</w:tr>`;
}

const filasPlantilla = prototipos.map((p) => filaPlantillaDe(p.idx, p.bucle)).join("");

// Propiedades de la tabla (tblPr, tblGrid) + encabezado + filas-plantilla.
let antesDeFilas = tabla.slice(0, tabla.indexOf(filas[0]));
if (extra) {
  // Una columna más en la rejilla: se clona el ancho de la última.
  const grid = /<w:tblGrid>[\s\S]*?<\/w:tblGrid>/.exec(antesDeFilas)?.[0];
  if (grid) {
    const cols = grid.match(/<w:gridCol[^>]*\/>/g) ?? [];
    const ultima = cols[cols.length - 1] ?? '<w:gridCol w:w="2000"/>';
    antesDeFilas = antesDeFilas.replace(grid, grid.replace("</w:tblGrid>", `${ultima}</w:tblGrid>`));
  }
}
const tablaNueva = `${antesDeFilas}${encabezadoConExtra()}${filasPlantilla}</w:tbl>`;

zip.file("word/document.xml", docXml.replace(tabla, tablaNueva));
await writeFile(destino, zip.generate({ type: "nodebuffer" }) as Buffer);

console.log("Plantilla escrita en:", destino);
console.log(`  tabla ${idxTabla}: ${filas.length} filas -> encabezado + ${prototipos.length} fila(s) prototipo`);
for (const p of prototipos) {
  console.log(`    fila ${p.idx} -> bucle {#${p.bucle}} … {/${p.bucle}} (conserva su estilo)`);
}
console.log(`  marcadores: ${tags.map((t) => `{${t}}`).join(" ")}`);
