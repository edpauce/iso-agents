/**
 * Genera una PLANTILLA .docx de cliente de EJEMPLO con marcadores docxtemplater
 * y un estilo visual propio (encabezado verde), para probar la fidelidad visual
 * exacta de la herramienta 4.2. Simula "el archivo del cliente ya etiquetado".
 *
 *   npx tsx scripts/gen-plantilla-partes.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
  HeadingLevel,
} from "docx";

const VERDE = "2E7D6F";
const borde = { style: BorderStyle.SINGLE, size: 6, color: "2E7D6F" } as const;
const BORDES = {
  top: borde,
  bottom: borde,
  left: borde,
  right: borde,
  insideHorizontal: borde,
  insideVertical: borde,
};

function celda(text: string, header = false): TableCell {
  return new TableCell({
    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: VERDE } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold: header, color: header ? "FFFFFF" : "000000", size: 18 }),
        ],
      }),
    ],
  });
}

const HEADERS = [
  "GRUPO DE INTERÉS",
  "NECESIDADES Y EXPECTATIVAS",
  "REQUISITO PERTINENTE",
  "TIPO",
  "¿SIG?",
  "PRIORIDAD",
];

// Fila-plantilla: {#partes} abre el bucle en la 1ª celda y {/partes} lo cierra en
// la última; docxtemplater repite esta fila por cada parte, conservando su estilo.
const TAGS = [
  "{#partes}{parte}",
  "{necesidades}",
  "{requisito}",
  "{tipo}",
  "{aborda}",
  "{prioridad}{/partes}",
];

async function main() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "MATRIZ DE PARTES INTERESADAS", bold: true, color: VERDE })],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Empresa: ", bold: true }), new TextRun("{empresa}")],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Código: ", bold: true }),
              new TextRun("{codigo}"),
              new TextRun({ text: "    Versión: ", bold: true }),
              new TextRun("{version}"),
            ],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: BORDES,
            rows: [
              new TableRow({ tableHeader: true, children: HEADERS.map((h) => celda(h, true)) }),
              new TableRow({ children: TAGS.map((t) => celda(t)) }),
            ],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({
            children: [
              new TextRun({ text: "Nota: ", bold: true }),
              new TextRun("la prioridad se califica de 1 (baja) a 3 (alta)."),
            ],
          }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const destino = path.resolve("ejemplos/plantilla-partes-interesadas.docx");
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, buf);
  console.log("Plantilla de ejemplo escrita en:", destino);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
