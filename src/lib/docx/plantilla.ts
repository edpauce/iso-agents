import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { aplicarMarcasDeCambio, limpiarMarcas } from "./marcas.js";

function expandir(ruta: string): string {
  if (ruta === "~") return os.homedir();
  if (ruta.startsWith("~/")) return path.join(os.homedir(), ruta.slice(2));
  return ruta;
}

/**
 * Rellena una PLANTILLA .docx del cliente (con marcadores docxtemplater)
 * conservando SU formato visual exacto (colores, bordes, logo, tipografía).
 * Solo reemplaza el texto de los marcadores y repite las filas de tabla marcadas.
 *
 * Convención de marcadores: campos simples `{campo}`; bucle sobre filas de tabla
 * con `{#items}` en la primera celda de la fila y `{/items}` en la última.
 */
export async function rellenarPlantilla(
  rutaPlantilla: string,
  datos: Record<string, unknown>
): Promise<Buffer> {
  const ruta = expandir(rutaPlantilla.trim());
  let binario: Buffer;
  try {
    binario = await readFile(ruta);
  } catch {
    throw new Error(`No se encontró la plantilla .docx en: ${ruta}`);
  }

  let doc: Docxtemplater;
  try {
    const zip = new PizZip(binario);
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // Un marcador de la plantilla del cliente que no alimentemos se deja en
      // blanco, en vez de romper la generación o escribir "undefined".
      nullGetter: () => "",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    throw new Error(`La plantilla no es un .docx válido: ${m}`);
  }

  try {
    doc.render(datos);
  } catch (e) {
    // docxtemplater agrupa errores de marcadores en e.properties.errors
    const props = (e as { properties?: { errors?: Array<{ properties?: { explanation?: string } }> } })
      .properties;
    const detalle =
      props?.errors?.map((x) => x.properties?.explanation).filter(Boolean).join("; ") ||
      (e instanceof Error ? e.message : String(e));
    throw new Error(
      `No se pudo rellenar la plantilla (revisa los marcadores {campo} / {#bucle}…{/bucle}): ${detalle}`
    );
  }

  // Control de cambios: colorea {{+ ... +}} / {{- ... -}} sobre el XML ya
  // rellenado, conservando el formato de la plantilla del cliente.
  const zipSalida = doc.getZip();
  const docXml = zipSalida.file("word/document.xml")?.asText();
  if (docXml) {
    const { xml, cambios } = aplicarMarcasDeCambio(docXml);
    zipSalida.file("word/document.xml", limpiarMarcas(xml));
    if (cambios) console.error(`[plantilla] ${cambios} fragmentos marcados como cambio.`);
  }

  return zipSalida.generate({ type: "nodebuffer" }) as Buffer;
}
