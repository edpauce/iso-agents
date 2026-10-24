import { limpiarMarcasTexto } from "./docx/marcas.js";

/**
 * Guarda de FIDELIDAD en runtime: compara el documento del cliente (origen)
 * contra el entregable generado y reporta qué fragmentos del origen no
 * aparecen (posibles pérdidas) y qué contenido es nuevo (adiciones a auditar).
 *
 * Es la automatización del diff que el consultor hacía a mano al validar el
 * caso real de un cliente financiero: la pérdida de una expectativa o una adición inventada son hallazgos
 * de auditoría, no detalles — y no pueden depender de que alguien relea el
 * Word completo cada vez. La guarda es independiente de la honestidad del
 * modelo: no confía en las marcas {{+ +}}; mide contra el texto.
 */
export interface ReporteFidelidad {
  total: number;
  conservados: number;
  perdidos: string[];
  nuevos: string[];
}

/** minúsculas, sin diacríticos, solo alfanumérico colapsado. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/** Celdas de una fila Markdown, respetando `\|` escapado. */
function celdasDe(linea: string): string[] {
  const cuerpo = linea.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let actual = "";
  for (let i = 0; i < cuerpo.length; i++) {
    if (cuerpo[i] === "\\" && cuerpo[i + 1] === "|") {
      actual += "|";
      i++;
    } else if (cuerpo[i] === "|") {
      out.push(actual);
      actual = "";
    } else actual += cuerpo[i];
  }
  out.push(actual);
  return out.map((c) => c.trim());
}

/** Longitud mínima (normalizada) para que un fragmento sea verificable. */
const MIN_FRAGMENTO = 25;

/**
 * Fragmentos verificables de un texto: los ÍTEMS de contenido (celdas de tabla
 * divididas por sus viñetas internas, y líneas con viñeta). Los títulos y
 * encabezados se excluyen a propósito: cambian legítimamente de formato a
 * formato; el contenido no debe cambiar sin ser reportado.
 * Si el texto no tiene tablas ni viñetas (p. ej. una política en prosa), cae a
 * fragmentos por oración.
 */
export function fragmentos(texto: string): string[] {
  const items: string[] = [];
  const lineas = texto.split("\n").map((l) => l.trim());
  const esSeparador = (l: string | undefined) => !!l && /^\|[\s:|-]+\|$/.test(l);
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l || l.startsWith(">")) continue; // notas de extracción
    if (esSeparador(l)) continue; // separador de tabla
    if (l.startsWith("|")) {
      // La fila inmediatamente anterior a un separador es el ENCABEZADO de la
      // tabla: son etiquetas de columna, no contenido a conservar/auditar.
      if (esSeparador(lineas[i + 1])) continue;
      for (const celda of celdasDe(l)) {
        for (const item of celda.split(/<br\s*\/?>|\s\/\s/i)) items.push(item);
      }
    } else if (/^[-*•]\s+/.test(l)) {
      items.push(l.replace(/^[-*•]\s+/, ""));
    }
  }
  // Fallback para documentos en prosa: oraciones.
  if (!items.length) {
    for (const oracion of texto.split(/(?<=[.;])\s+/)) items.push(oracion);
  }
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const limpio = item.replace(/\*\*/g, "").trim();
    const n = normalizar(limpio);
    if (n.length < MIN_FRAGMENTO || vistos.has(n)) continue;
    vistos.add(n);
    out.push(limpio);
  }
  return out;
}

/**
 * ¿El fragmento está presente en el blob? Dos niveles: prefijo normalizado de
 * 40 chars (conserva la redacción), o ≥85% de sus palabras significativas
 * presentes (tolera reformulación leve sin dar la pérdida por falsa).
 */
function presente(frag: string, blobNorm: string, palabrasBlob: Set<string>): boolean {
  const n = normalizar(frag);
  if (blobNorm.includes(n.slice(0, 40))) return true;
  const palabras = n.split(" ").filter((w) => w.length > 3);
  if (!palabras.length) return true;
  const halladas = palabras.filter((w) => palabrasBlob.has(w)).length;
  return halladas / palabras.length >= 0.85;
}

/**
 * Quita las secciones meta del entregable (Cambios realizados, Pendientes,
 * Brechas): son notas del consultor, no contenido. Sin esto, un ítem del
 * origen citado SOLO en "Cambios realizados" contaría como conservado, y cada
 * línea de esas secciones aparecería como adición falsa.
 */
export function quitarSeccionesMeta(texto: string): string {
  return texto.replace(
    /^##\s*(Cambios realizados|Pendientes de definici[oó]n[^\n]*|Brechas frente[^\n]*)\s*$[\s\S]*?(?=^##\s|(?![\s\S]))/gim,
    ""
  );
}

export function verificarFidelidad(
  origen: string,
  salida: string,
  opts: {
    /**
     * Texto ADICIONAL que cuenta como presente en el entregable para el
     * chequeo de pérdidas, pero que NO genera adiciones. Caso: el texto
     * estático de la plantilla del cliente (título, código, notas) — está en
     * el .docx final por construcción, aunque no aparezca en el markdown.
     */
    contextoSalida?: string;
  } = {}
): ReporteFidelidad {
  const salidaLimpia = quitarSeccionesMeta(limpiarMarcasTexto(salida));
  const origenLimpio = limpiarMarcasTexto(origen);

  const fragsOrigen = fragmentos(origenLimpio);
  const fragsSalida = fragmentos(salidaLimpia);

  const blobSalida = normalizar(salidaLimpia + "\n" + (opts.contextoSalida ?? ""));
  const palabrasSalida = new Set(blobSalida.split(" ").filter((w) => w.length > 3));
  const blobOrigen = normalizar(origenLimpio);
  const palabrasOrigen = new Set(blobOrigen.split(" ").filter((w) => w.length > 3));

  const perdidos = fragsOrigen.filter((f) => !presente(f, blobSalida, palabrasSalida));
  const nuevos = fragsSalida.filter((f) => !presente(f, blobOrigen, palabrasOrigen));

  return {
    total: fragsOrigen.length,
    conservados: fragsOrigen.length - perdidos.length,
    perdidos,
    nuevos,
  };
}

const recorte = (s: string) => (s.length > 90 ? s.slice(0, 90) + "…" : s);
const listar = (items: string[]) => {
  const top = items.slice(0, 10).map((x, i) => `   ${i + 1}. «${recorte(x)}»`);
  if (items.length > 10) top.push(`   … y ${items.length - 10} más`);
  return top.join("\n");
};

/** Bloque de texto que se anexa a la respuesta de la herramienta. */
export function formatearReporte(r: ReporteFidelidad): string {
  const pct = r.total ? Math.round((100 * r.conservados) / r.total) : 100;
  const lineas = [
    `🔎 Verificación de fidelidad (automática, origen → entregable)`,
    `- Fragmentos del origen conservados: ${r.conservados}/${r.total} (${pct}%)`,
  ];
  if (r.perdidos.length) {
    lineas.push(
      `⚠️ POSIBLES PÉRDIDAS del contenido original (${r.perdidos.length}) — revísalas antes de entregar:`,
      listar(r.perdidos)
    );
  } else {
    lineas.push(`- Sin pérdidas detectadas.`);
  }
  if (r.nuevos.length) {
    lineas.push(
      `➕ Adiciones no presentes en el origen (${r.nuevos.length}) — confirma que respondan a la norma:`,
      listar(r.nuevos)
    );
  } else {
    lineas.push(`- Sin adiciones.`);
  }
  return lineas.join("\n");
}
