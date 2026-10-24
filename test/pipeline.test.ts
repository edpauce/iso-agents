import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PizZip from "pizzip";
import { rellenarPlantilla } from "../src/lib/docx/plantilla.js";
import { dirTemporal, docFuentePlantilla } from "./helpers.js";

const exec = promisify(execFile);
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const xmlDe = (buf: Buffer) => new PizZip(buf).file("word/document.xml")!.asText();

/**
 * Pipeline completo del caso real de un cliente financiero, sin API y sin datos del cliente:
 *   .docx del cliente → docx-a-plantilla (2 filas prototipo + columna extra)
 *   → rellenarPlantilla (bucles, listas, control de cambios).
 * Aquí vivieron las 6 regresiones de la sesión 2026-07-08/09.
 */
test("pipeline: plantilla desde .docx real + rellenado fiel", { timeout: 120000 }, async () => {
  const dir = await dirTemporal();
  const fuente = await docFuentePlantilla(dir);
  const plantilla = path.join(dir, "plantilla.docx");

  // 1. Convertir el doc del cliente en plantilla: dos filas prototipo (una por
  //    color de ámbito) + columna nueva del literal c).
  const { stdout } = await exec(
    "npx",
    [
      "tsx",
      path.join(RAIZ, "scripts/docx-a-plantilla.ts"),
      fuente,
      plantilla,
      "0",
      "1:internas,2:externas",
      "ambito,parte,lista:requisitosLista,lista:necesidadesLista",
      "ABORDADO MEDIANTE EL SGAS::aborda",
    ],
    { cwd: RAIZ }
  );
  assert.match(stdout, /2 fila\(s\) prototipo/);

  // 2. Rellenarla con datos controlados (con marcas de cambio incluidas).
  const internas = [
    {
      ambito: "INTERNO",
      parte: "Directorio",
      requisitosLista: ["Revisión periódica del desempeño.", "Cumplimiento de lineamientos."],
      necesidadesLista: [
        "Confianza de los grupos de interés.",
        "Involucramiento gerencial.",
        "{{+Determinar si el cambio climático es pertinente.+}}",
      ],
      aborda: "Revisión por la dirección (cláusula 9.3)",
    },
    {
      ambito: "INTERNO",
      parte: "Colaboradores",
      requisitosLista: ["Canales de denuncia."],
      necesidadesLista: ["Ambiente laboral con integridad."],
      aborda: "{{+Canal de denuncias y protección al denunciante+}}",
    },
  ];
  const externas = [
    {
      ambito: "EXTERNO",
      parte: "Proveedores",
      requisitosLista: ["Cumplimiento del TUO.", "{{-Referencia obsoleta 2016.-}}"],
      necesidadesLista: ["Transparencia.", "Pago oportuno."],
      // sin 'aborda': el nullGetter debe dejar la celda en blanco, no "undefined"
    },
  ];
  const buf = await rellenarPlantilla(plantilla, { empresa: "Banco de Prueba", internas, externas });
  const xml = xmlDe(buf);

  // 3. Estructura: header + 2 internas + 1 externa.
  const filas = xml.match(/<w:tr[ >]/g) ?? [];
  assert.equal(filas.length, 4, "header + 2 internas + 1 externa");

  // 4. Fidelidad de color por ámbito (la regresión del salmón).
  assert.ok(xml.includes("DDEBF7"), "celeste de filas internas conservado");
  assert.ok(xml.includes("FCE4D6"), "salmón de filas externas conservado");
  assert.ok(
    (xml.match(/DDEBF7/g) ?? []).length > (xml.match(/FCE4D6/g) ?? []).length,
    "2 filas internas > 1 externa"
  );

  // 5. Viñetas: una por elemento de lista (la regresión del aplastado).
  const numPr = (xml.match(/<w:numPr>/g) ?? []).length;
  assert.ok(numPr >= 11, `viñetas por ítem de lista (hay ${numPr}, se esperan ≥11)`);

  // 6. Control de cambios: verde/rojo aplicados, cero marcas residuales.
  assert.ok(xml.includes("1E7B34"), "agregados en verde");
  assert.ok(xml.includes("B00020") && xml.includes("<w:strike/>"), "eliminado en rojo tachado");
  assert.ok(!xml.includes("{{"), "sin marcas residuales");

  // 7. nullGetter: marcador sin dato queda en blanco, jamás 'undefined'.
  assert.ok(!xml.includes("undefined"));

  // 8. Congelamiento de fidelidad: TODO ítem de entrada aparece en la salida.
  const items = [...internas, ...externas].flatMap((f) => [
    f.parte,
    ...f.requisitosLista,
    ...f.necesidadesLista,
  ]);
  for (const item of items) {
    const limpio = item.replace(/\{\{[+-]/g, "").replace(/[+-]\}\}/g, "");
    assert.ok(xml.includes(limpio), `ítem perdido en la salida: «${limpio}»`);
  }
});

test("rellenarPlantilla: errores con mensaje claro", async () => {
  const dir = await dirTemporal();
  await assert.rejects(
    () => rellenarPlantilla(path.join(dir, "no-existe.docx"), {}),
    /No se encontró la plantilla/
  );
  const falso = path.join(dir, "falso.docx");
  await writeFile(falso, "esto no es un zip");
  await assert.rejects(() => rellenarPlantilla(falso, {}), /no es un \.docx válido/);
});
