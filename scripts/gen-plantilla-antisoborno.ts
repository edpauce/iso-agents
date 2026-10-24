/**
 * Genera una PLANTILLA .docx de EJEMPLO (entidad financiera FICTICIA) con
 * marcadores docxtemplater, incluida la columna del literal c) de ISO 37001:2025.
 *
 * Simula el trabajo de "preparar la plantilla una vez": a veces el .docx real del cliente
 * no sirve como plantilla porque su columna Ámbito es una celda combinada sobre
 * 26 filas y docxtemplater no puede repetir filas dentro de una celda combinada.
 *
 *   npx tsx scripts/gen-plantilla-antisoborno.ts
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
  AlignmentType,
  HeadingLevel,
} from "docx";

// Identidad visual del "cliente" (granate institucional), distinta del azul casa.
const GRANATE = "7A1F2B";
const GRIS = "F2EFEF";
const borde = { style: BorderStyle.SINGLE, size: 6, color: GRANATE } as const;
const BORDES = {
  top: borde,
  bottom: borde,
  left: borde,
  right: borde,
  insideHorizontal: borde,
  insideVertical: borde,
};

function celda(text: string, header = false, ancho?: number): TableCell {
  return new TableCell({
    ...(ancho ? { width: { size: ancho, type: WidthType.PERCENTAGE } } : {}),
    shading: { type: ShadingType.CLEAR, color: "auto", fill: header ? GRANATE : GRIS },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({ text, bold: header, color: header ? "FFFFFF" : "000000", size: 16 }),
        ],
      }),
    ],
  });
}

const HEADERS = [
  "ÁMBITO",
  "GRUPO DE INTERÉS",
  "REQUISITOS OBLIGATORIOS",
  "EXPECTATIVAS",
  "REQUISITOS ABORDADOS MEDIANTE EL SGAS",
];
const ANCHOS = [10, 18, 26, 26, 20];

// Fila-plantilla: {#partes} abre el bucle en la 1ª celda, {/partes} lo cierra en
// la última. docxtemplater repite esta fila conservando su formato.
const TAGS = [
  "{#partes}{ambito}",
  "{parte}",
  "{requisitos}",
  "{necesidades}",
  "{aborda}{/partes}",
];

async function main() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "MATRIZ DE GRUPOS DE INTERÉS DEL SISTEMA DE GESTIÓN ANTISOBORNO",
                bold: true,
                color: GRANATE,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "CÓDIGO: SGAS-F-002-V02", bold: true, size: 18 }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Entidad: ", bold: true }), new TextRun("{empresa}")],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Alineada a la Norma Internacional ISO 37001:2025 (2ª edición).",
                italics: true,
                size: 16,
              }),
            ],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: BORDES,
            rows: [
              new TableRow({
                tableHeader: true,
                children: HEADERS.map((h, i) => celda(h, true, ANCHOS[i])),
              }),
              new TableRow({ children: TAGS.map((t, i) => celda(t, false, ANCHOS[i])) }),
            ],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({
            children: [
              new TextRun({ text: "Nota: ", bold: true, size: 16 }),
              new TextRun({
                text: "la columna «Requisitos abordados mediante el SGAS» responde al literal c) del requisito 4.2 de ISO 37001:2025.",
                size: 16,
              }),
            ],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({
            children: [
              new TextRun({ text: "Elaborado por: ____________________     ", size: 16 }),
              new TextRun({ text: "Aprobado por: ____________________", size: 16 }),
            ],
          }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const destino = path.resolve("ejemplos/plantilla-antisoborno-partes-interesadas.docx");
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, buf);
  console.log("Plantilla antisoborno de ejemplo escrita en:", destino);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
