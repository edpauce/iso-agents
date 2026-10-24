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
 * Generador de Word "formato casa" a partir de datos estructurados. Produce un
 * documento profesional con tablas, encabezado de color y bordes — para VER el
 * entregable renderizado (no solo Markdown) y entregarlo cuando el cliente no
 * tiene plantilla propia.
 */
export interface DocTabla {
  headers: string[];
  filas: string[][];
}
export interface DocSeccion {
  heading?: string;
  parrafo?: string;
  /** Lista de viñetas (para secciones que no son tabla, ej. alcance 4.3). */
  lista?: string[];
  tabla?: DocTabla;
}
export interface DocSpec {
  titulo: string;
  empresa: string;
  requisito: string;
  intro?: string;
  secciones: DocSeccion[];
}

const AZUL = "1F4E79";
const borde = { style: BorderStyle.SINGLE, size: 4, color: "9DB2C4" } as const;
const BORDES = {
  top: borde,
  bottom: borde,
  left: borde,
  right: borde,
  insideHorizontal: borde,
  insideVertical: borde,
};

function celda(text: string, header = false): TableCell {
  // Soporta celdas multilínea: cada '\n' del texto es un párrafo dentro de la celda.
  const lineas = String(text ?? "").split("\n");
  return new TableCell({
    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: AZUL } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: lineas.map(
      (l) =>
        new Paragraph({
          children: [
            new TextRun({
              text: l,
              bold: header,
              color: header ? "FFFFFF" : "000000",
              size: 18,
            }),
          ],
        })
    ),
  });
}

function tabla(t: DocTabla): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: BORDES,
    rows: [
      new TableRow({ tableHeader: true, children: t.headers.map((h) => celda(h, true)) }),
      ...t.filas.map((f) => new TableRow({ children: f.map((c) => celda(c)) })),
    ],
  });
}

export async function construirDocx(spec: DocSpec): Promise<Buffer> {
  const hijos: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: spec.titulo, bold: true, color: AZUL })],
    }),
    new Paragraph({
      children: [new TextRun({ text: "Empresa: ", bold: true }), new TextRun(spec.empresa)],
    }),
    new Paragraph({
      children: [new TextRun({ text: "Requisito: ", bold: true }), new TextRun(spec.requisito)],
    }),
    new Paragraph({ children: [new TextRun("")] }),
  ];
  if (spec.intro) hijos.push(new Paragraph({ children: [new TextRun(spec.intro)] }));

  for (const s of spec.secciones) {
    if (s.heading)
      hijos.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: s.heading, bold: true })],
        })
      );
    if (s.parrafo) hijos.push(new Paragraph({ children: [new TextRun(s.parrafo)] }));
    if (s.lista) {
      for (const item of s.lista.filter((x) => x?.trim())) {
        hijos.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(item.trim())] }));
      }
      hijos.push(new Paragraph({ children: [new TextRun("")] }));
    }
    if (s.tabla) {
      hijos.push(tabla(s.tabla));
      hijos.push(new Paragraph({ children: [new TextRun("")] }));
    }
  }

  const doc = new Document({ sections: [{ children: hijos }] });
  return await Packer.toBuffer(doc);
}
