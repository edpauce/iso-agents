import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
} from "docx";

/**
 * Conversor Markdown → Word. Se usa en el modo `formato: cliente`, donde el
 * modelo devuelve el documento replicando el formato del cliente en Markdown
 * (no hay esquema estructurado del que partir). Sin esto, ese modo no producía
 * un entregable abrible en Word.
 *
 * Soporta: encabezados, tablas (con `<br>` dentro de celda), viñetas, citas y
 * negritas `**...**`.
 */
const AZUL = "1F4E79";
/** Control de cambios: verde = agregado/modificado, rojo tachado = eliminado. */
const VERDE = "1E7B34";
const ROJO = "B00020";
const borde = { style: BorderStyle.SINGLE, size: 4, color: "9DB2C4" } as const;
const BORDES = {
  top: borde,
  bottom: borde,
  left: borde,
  right: borde,
  insideHorizontal: borde,
  insideVertical: borde,
};

/** Marcas de control de cambios y negritas. */
const TOKEN = /(\{\{\+[\s\S]*?\+\}\}|\{\{-[\s\S]*?-\}\}|\*\*[^*]+\*\*)/g;
const sinNegritas = (s: string) => s.replace(/\*\*/g, "");

/**
 * Trocea el texto en TextRun aplicando negritas `**...**` y el control de
 * cambios: `{{+ nuevo +}}` en verde y `{{- eliminado -}}` en rojo tachado.
 */
function runs(texto: string, opts: { bold?: boolean; color?: string; size?: number } = {}) {
  const { bold = false, color, size = 18 } = opts;
  return texto
    .split(TOKEN)
    .filter((s) => s && s.length)
    .map((trozo) => {
      if (/^\{\{\+[\s\S]*\+\}\}$/.test(trozo)) {
        return new TextRun({
          text: sinNegritas(trozo.slice(3, -3)).trim(),
          bold: true,
          color: VERDE,
          size,
        });
      }
      if (/^\{\{-[\s\S]*-\}\}$/.test(trozo)) {
        return new TextRun({
          text: sinNegritas(trozo.slice(3, -3)).trim(),
          strike: true,
          color: ROJO,
          size,
        });
      }
      const negrita = /^\*\*[^*]+\*\*$/.test(trozo);
      return new TextRun({
        text: negrita ? trozo.slice(2, -2) : trozo,
        bold: bold || negrita,
        ...(color ? { color } : {}),
        size,
      });
    });
}

/** Contenido de una celda: `<br>` y `\n` separan párrafos. */
function celda(texto: string, header: boolean): TableCell {
  const lineas = texto
    .replace(/<br\s*\/?>/gi, "\n")
    .split("\n")
    .map((l) => l.replace(/\\\|/g, "|").trim());
  return new TableCell({
    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: AZUL } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: lineas.map(
      (l) =>
        new Paragraph({
          children: runs(l, header ? { bold: true, color: "FFFFFF" } : {}),
        })
    ),
  });
}

/** Divide una fila Markdown en celdas, respetando `\|` escapado. */
function celdasDeFila(linea: string): string[] {
  const cuerpo = linea.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let actual = "";
  for (let i = 0; i < cuerpo.length; i++) {
    if (cuerpo[i] === "\\" && cuerpo[i + 1] === "|") {
      actual += "\\|";
      i++;
    } else if (cuerpo[i] === "|") {
      out.push(actual);
      actual = "";
    } else actual += cuerpo[i];
  }
  out.push(actual);
  return out.map((c) => c.trim());
}

const esSeparador = (l: string) => /^\|[\s:|-]+\|$/.test(l.trim());

function tablaDeBloque(lineas: string[]): Table | null {
  const filas = lineas.filter((l) => !esSeparador(l)).map(celdasDeFila);
  if (!filas.length) return null;
  const ancho = Math.max(...filas.map((f) => f.length));
  const norm = (f: string[]) => Array.from({ length: ancho }, (_, i) => f[i] ?? "");
  const [cab, ...cuerpo] = filas;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDES,
    rows: [
      new TableRow({ tableHeader: true, children: norm(cab).map((c) => celda(c, true)) }),
      ...cuerpo.map((f) => new TableRow({ children: norm(f).map((c) => celda(c, false)) })),
    ],
  });
}

export interface MetaDocumento {
  titulo: string;
  empresa: string;
  requisito: string;
}

export async function mdADocx(md: string, meta: MetaDocumento): Promise<Buffer> {
  const hijos: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: meta.titulo, bold: true, color: AZUL })],
    }),
    new Paragraph({
      children: [new TextRun({ text: "Empresa: ", bold: true }), new TextRun(meta.empresa)],
    }),
    new Paragraph({
      children: [new TextRun({ text: "Requisito: ", bold: true }), new TextRun(meta.requisito)],
    }),
    new Paragraph({ children: [new TextRun("")] }),
  ];

  const lineas = md.split("\n");
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];

    if (l.trim().startsWith("|")) {
      const bloque: string[] = [];
      while (i < lineas.length && lineas[i].trim().startsWith("|")) bloque.push(lineas[i++]);
      const t = tablaDeBloque(bloque);
      if (t) {
        hijos.push(t);
        hijos.push(new Paragraph({ children: [new TextRun("")] }));
      }
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) {
      const nivel = h[1].length;
      hijos.push(
        new Paragraph({
          heading: nivel <= 1 ? HeadingLevel.HEADING_1 : nivel === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          children: runs(h[2], { bold: true, size: 24 }),
        })
      );
      i++;
      continue;
    }

    const vi = /^\s*[-*]\s+(.*)$/.exec(l);
    if (vi) {
      hijos.push(new Paragraph({ bullet: { level: 0 }, children: runs(vi[1]) }));
      i++;
      continue;
    }

    const cita = /^\s*>\s?(.*)$/.exec(l);
    if (cita) {
      hijos.push(
        new Paragraph({ indent: { left: 360 }, children: runs(cita[1], { size: 16 }) })
      );
      i++;
      continue;
    }

    if (l.trim()) hijos.push(new Paragraph({ children: runs(l) }));
    i++;
  }

  return await Packer.toBuffer(new Document({ sections: [{ children: hijos }] }));
}
