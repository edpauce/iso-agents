import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
} from "docx";

/**
 * Fixtures sintéticos para los tests. Reproducen las PATOLOGÍAS REALES del
 * caso real de un cliente del sector financiero (celdas combinadas ambiguas, viñetas por celda,
 * colores condicionales por fila) SIN meter datos del cliente al repo.
 */

export async function dirTemporal(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), "ehsq-test-"));
}

function celda(
  textos: string[],
  opts: { fill?: string; rowSpan?: number; columnSpan?: number; bullet?: boolean } = {}
): TableCell {
  return new TableCell({
    ...(opts.rowSpan ? { rowSpan: opts.rowSpan } : {}),
    ...(opts.columnSpan ? { columnSpan: opts.columnSpan } : {}),
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    children: textos.map(
      (t) =>
        new Paragraph({
          ...(opts.bullet ? { bullet: { level: 0 } } : {}),
          children: [new TextRun({ text: t, size: 18 })],
        })
    ),
  });
}

async function escribir(dir: string, nombre: string, doc: Document): Promise<string> {
  const ruta = path.join(dir, nombre);
  await writeFile(ruta, await Packer.toBuffer(doc));
  return ruta;
}

/**
 * Reproduce la patología del documento original del cliente (edición 2016 de la norma): la columna Ámbito es UNA celda combinada
 * sobre todas las filas con DOS valores dentro («INTERNO» y «EXTERNO»), el
 * encabezado usa colspan, y hay celdas con varios párrafos y texto truncado.
 */
export async function docPatologiaCliente(dir: string): Promise<string> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  celda(["GRUPO DE INTERÉS"], { columnSpan: 2 }),
                  celda(["REQUISITOS OBLIGATORIOS"]),
                  celda(["EXPECTATIVAS"]),
                ],
              }),
              new TableRow({
                children: [
                  // La celda ambigua: combinada sobre 3 filas, con 2 valores.
                  celda(["INTERNO", "EXTERNO"], { rowSpan: 3 }),
                  celda(["DIRECTORIO"]),
                  celda(["Revisión periódica del desempeño del sistema."]),
                  celda(["Incremento de la confianza.", "Involucramiento de la plana gerencial."]),
                ],
              }),
              new TableRow({
                children: [
                  celda(["GERENCIA GENERAL"]),
                  celda(["Aseguramiento de los recursos."]),
                  celda(["Revisión periódica del desempeño."]),
                ],
              }),
              new TableRow({
                children: [
                  celda(["SINDICATOS"]),
                  celda(["Canales de denuncia y protección al denunciante."]),
                  // Texto truncado, como el real.
                  celda(["Evaluación objetiva a los trabajadores que hayan vulnerado el sistema de"]),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });
  return await escribir(dir, "patologia-cliente.docx", doc);
}

/** Celda combinada de UN solo valor: etiqueta legítima, debe repetirse sin aviso. */
export async function docEtiquetaCombinada(dir: string): Promise<string> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [celda(["ÁMBITO"]), celda(["GRUPO"]), celda(["DETALLE"])],
              }),
              new TableRow({
                children: [
                  celda(["INTERNO"], { rowSpan: 2 }),
                  celda(["Directorio"]),
                  celda(["a"]),
                ],
              }),
              new TableRow({ children: [celda(["Gerencia"]), celda(["b"])] }),
            ],
          }),
        ],
      },
    ],
  });
  return await escribir(dir, "etiqueta-combinada.docx", doc);
}

/**
 * Documento fuente para convertir en plantilla: encabezado + 2 filas de datos
 * con SOMBREADO DISTINTO por fila (celeste interno / salmón externo, como la
 * versión alineada del cliente) y viñetas reales dentro de las celdas de lista.
 */
export async function docFuentePlantilla(dir: string): Promise<string> {
  const filaDatos = (fill: string, ambito: string, parte: string) =>
    new TableRow({
      children: [
        celda([ambito], { fill }),
        celda([parte], { fill }),
        celda(["Requisito uno.", "Requisito dos."], { fill, bullet: true }),
        celda(["Expectativa uno.", "Expectativa dos."], { fill, bullet: true }),
      ],
    });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: "MATRIZ DE PRUEBA", bold: true })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  celda(["ÁMBITO"], { fill: "1F3864" }),
                  celda(["GRUPO DE INTERÉS"], { fill: "1F3864" }),
                  celda(["REQUISITOS"], { fill: "1F3864" }),
                  celda(["EXPECTATIVAS"], { fill: "1F3864" }),
                ],
              }),
              filaDatos("DDEBF7", "INTERNO", "Directorio"),
              filaDatos("FCE4D6", "EXTERNO", "Proveedores"),
            ],
          }),
        ],
      },
    ],
  });
  return await escribir(dir, "fuente-plantilla.docx", doc);
}
