import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mammoth from "mammoth";

/** Expande `~` al home del usuario (Node no lo hace solo). */
function expandir(ruta: string): string {
  if (ruta === "~") return os.homedir();
  if (ruta.startsWith("~/")) return path.join(os.homedir(), ruta.slice(2));
  return ruta;
}

/** Decodifica las entidades HTML que emite mammoth. */
function desescapar(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Texto de una celda. Los párrafos internos se separan con " / " (no se
 * colapsan): así una celda con varios valores queda visible como tal.
 * Escapa `|` para no romper la tabla Markdown.
 */
function textoCelda(html: string): string {
  const conSaltos = html.replace(/<\/(p|div|li)>/g, "\n").replace(/<br\s*\/?>/g, "\n");
  const partes = desescapar(conSaltos.replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return partes.join(" / ").replace(/\|/g, "\\|");
}

/** Nº de párrafos de una celda (para detectar celdas combinadas ambiguas). */
function nParrafos(html: string): number {
  return textoCelda(html).split(" / ").filter(Boolean).length;
}

/**
 * Convierte una <table> de mammoth a tabla Markdown. Se respeta `colspan`/
 * `rowspan` de forma simple: una celda combinada se repite en las columnas que
 * abarca, para que el modelo vea la rejilla completa (p. ej. la columna
 * "Ámbito" con INTERNO/EXTERNO combinado sobre varias filas).
 */
function tablaAMarkdown(tablaHtml: string): { md: string; avisos: string[] } {
  const filasHtml = [...tablaHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const filas: string[][] = [];
  const avisos: string[] = [];
  // Celdas pendientes por rowspan: columna -> { texto, filasRestantes }
  const pendientes = new Map<number, { texto: string; restan: number }>();

  for (const filaHtml of filasHtml) {
    const celdas = [...filaHtml.matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/g)];
    const fila: string[] = [];
    let col = 0;

    const volcarPendientes = () => {
      while (pendientes.has(col)) {
        const p = pendientes.get(col)!;
        fila[col] = p.texto;
        p.restan -= 1;
        if (p.restan <= 0) pendientes.delete(col);
        col += 1;
      }
    };

    volcarPendientes();
    for (const [, attrs, contenido] of celdas) {
      const texto = textoCelda(contenido);
      const colspan = Number(/colspan="(\d+)"/.exec(attrs)?.[1] ?? 1);
      const rowspan = Number(/rowspan="(\d+)"/.exec(attrs)?.[1] ?? 1);

      // Celda combinada verticalmente que contiene VARIOS valores: el documento
      // origen no permite saber qué valor aplica a cada fila. Se avisa en vez de adivinar.
      if (rowspan > 1 && nParrafos(contenido) > 1) {
        avisos.push(
          `La celda de la columna ${col + 1} está combinada sobre ${rowspan} filas y contiene varios valores («${texto}»). El documento origen NO permite determinar cuál aplica a cada fila; no lo infieras.`
        );
      }

      for (let k = 0; k < colspan; k++) {
        // rowspan = etiqueta que aplica a cada fila abarcada → se repite.
        // colspan = encabezado combinado → se escribe una vez, el resto vacío.
        fila[col] = k === 0 ? texto : "";
        if (rowspan > 1 && k === 0) pendientes.set(col, { texto, restan: rowspan - 1 });
        col += 1;
      }
      volcarPendientes();
    }
    // Una fila totalmente vacía (típica de tablas con imágenes) no aporta.
    if (fila.some((c) => c && c.length)) filas.push(fila);
  }

  if (!filas.length) return { md: "", avisos: [] };
  const ancho = Math.max(...filas.map((f) => f.length));
  const norm = (f: string[]) =>
    Array.from({ length: ancho }, (_, i) => (f[i] ?? "").trim() || " ");

  const [cabecera, ...cuerpo] = filas;
  const lineas = [
    `| ${norm(cabecera).join(" | ")} |`,
    `| ${Array.from({ length: ancho }, () => "---").join(" | ")} |`,
    ...cuerpo.map((f) => `| ${norm(f).join(" | ")} |`),
  ];
  return { md: lineas.join("\n"), avisos: [...new Set(avisos)] };
}

/**
 * Convierte el HTML de mammoth a texto plano conservando la ESTRUCTURA de las
 * tablas (como tablas Markdown). Es clave para los entregables del SIG, que casi
 * siempre son matrices: si se aplana la tabla, el modelo no sabe qué valor está
 * en qué columna ni qué celda está vacía.
 */
function htmlATexto(html: string): string {
  // Fuera imágenes (mammoth las embebe en base64 y son enormes).
  let s = html.replace(/<img[^>]*>/g, "");

  // Reemplaza cada tabla por su versión Markdown, con nota de extracción si
  // hay celdas combinadas ambiguas.
  s = s.replace(/<table[^>]*>[\s\S]*?<\/table>/g, (t) => {
    const { md, avisos } = tablaAMarkdown(t);
    if (!md) return "\n\n";
    const nota = avisos.length
      ? `\n\n> NOTA DE EXTRACCIÓN (limitación del documento origen):\n${avisos
          .map((a) => `> - ${a}`)
          .join("\n")}`
      : "";
    return `\n\n${md}${nota}\n\n`;
  });

  // Bloques a saltos de línea; el resto se limpia de etiquetas.
  s = s
    .replace(/<\/(p|h[1-6]|li|div|br)[^>]*>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "");

  return desescapar(s)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extrae el texto de un documento del cliente por ruta local.
 * Soporta .docx (mammoth, PRESERVANDO TABLAS), .txt y .md.
 * Para PDF, por ahora pega el texto en `documentoCliente`.
 */
export async function extraerTexto(rutaCruda: string): Promise<string> {
  const ruta = expandir(rutaCruda.trim());
  const ext = path.extname(ruta).toLowerCase();

  if (ext === ".docx") {
    const { value } = await mammoth.convertToHtml({ path: ruta });
    return htmlATexto(value);
  }
  if (ext === ".txt" || ext === ".md" || ext === ".markdown") {
    return (await readFile(ruta, "utf8")).trim();
  }
  if (ext === ".pdf") {
    throw new Error(
      `PDF por ruta aún no está soportado. Convierte a .docx o pega el texto en 'documentoCliente'. (archivo: ${ruta})`
    );
  }
  throw new Error(
    `Formato no soportado: '${ext || "(sin extensión)"}'. Usa .docx, .txt o .md, o pega el texto en 'documentoCliente'.`
  );
}
