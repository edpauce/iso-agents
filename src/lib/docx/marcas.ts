/**
 * Control de cambios DENTRO de la plantilla del cliente.
 *
 * El modelo envuelve lo nuevo/modificado en {{+ ... +}} y lo eliminado en
 * {{- ... -}}. docxtemplater inserta esos marcadores como texto plano dentro de
 * los runs de la plantilla; aquí se parte cada run y se colorea el fragmento
 * marcado, conservando el resto de sus propiedades (fuente, tamaño, estilo).
 *
 * Así el entregable mantiene la identidad visual del cliente Y muestra los
 * cambios de un vistazo, como exige el flujo de alineación documental.
 */
export const VERDE = "1E7B34";
export const ROJO = "B00020";

const RE_RUN = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
const RE_T = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/;
const RE_RPR = /<w:rPr>[\s\S]*?<\/w:rPr>/;
const RE_MARCA = /(\{\{\+[\s\S]*?\+\}\}|\{\{-[\s\S]*?-\}\})/g;

/** Propiedades de run con el color/estilo del cambio, sin duplicar w:color/w:b. */
function propsConEstilo(rPr: string, color: string, tachado: boolean): string {
  const extra = `<w:b/><w:color w:val="${color}"/>${tachado ? "<w:strike/>" : ""}`;
  if (!rPr) return `<w:rPr>${extra}</w:rPr>`;
  const limpio = rPr
    .replace(/<w:color[^>]*\/>/g, "")
    .replace(/<w:b\/>/g, "")
    .replace(/<w:strike[^>]*\/>/g, "");
  return limpio.replace("</w:rPr>", `${extra}</w:rPr>`);
}

/** El texto ya viene escapado desde el XML: NO se vuelve a escapar. */
function run(rPr: string, texto: string, color?: string, tachado = false): string {
  const props = color ? propsConEstilo(rPr, color, tachado) : rPr;
  return `<w:r>${props}<w:t xml:space="preserve">${texto}</w:t></w:r>`;
}

/**
 * Recorre los runs del document.xml, expande los que contengan marcas y
 * devuelve el XML con los cambios coloreados y los marcadores eliminados.
 */
export function aplicarMarcasDeCambio(xml: string): { xml: string; cambios: number } {
  let cambios = 0;
  const salida = xml.replace(RE_RUN, (r) => {
    if (!r.includes("{{+") && !r.includes("{{-")) return r;
    const mt = RE_T.exec(r);
    if (!mt) return r;
    const rPr = RE_RPR.exec(r)?.[0] ?? "";
    const partes = mt[1].split(RE_MARCA).filter((p) => p.length);
    if (!partes.some((p) => p.startsWith("{{"))) return r;

    return partes
      .map((p) => {
        if (p.startsWith("{{+")) {
          cambios++;
          return run(rPr, p.slice(3, -3), VERDE);
        }
        if (p.startsWith("{{-")) {
          cambios++;
          return run(rPr, p.slice(3, -3), ROJO, true);
        }
        return run(rPr, p);
      })
      .join("");
  });
  return { xml: salida, cambios };
}

/** Quita cualquier marca residual (por si un run no pudo partirse). */
export function limpiarMarcas(xml: string): string {
  return xml.replace(/\{\{\+([\s\S]*?)\+\}\}/g, "$1").replace(/\{\{-([\s\S]*?)-\}\}/g, "$1");
}

/**
 * Igual que `limpiarMarcas`, para texto plano (Markdown). El Markdown se
 * entrega sin marcas; el control de cambios vive en el .docx, en color.
 */
export const limpiarMarcasTexto = limpiarMarcas;
