import { test } from "node:test";
import assert from "node:assert/strict";
import {
  render,
  renderDocx,
  datosPlantilla,
  type Resultado,
} from "../src/tools/clausula4/partesInteresadas.js";
import type { Perfil } from "../src/lib/perfil.js";

/**
 * Congela las regresiones semánticas del caso real de un cliente financiero:
 *  - enums con marcas de cambio vaciaban el documento (filtro frágil),
 *  - el literal c) llevaba un "Sí" fabricado,
 *  - las listas se aplastaban en un solo párrafo.
 */

const perfil: Perfil = { nombre: "Banco de Prueba", sector: "Banca" };

// Fixture con las tolerancias que el modelo real ejercitó:
//  - tipo con marca de cambio ("{{+externa+}}"),
//  - requisitos como STRING donde el esquema pide arreglo,
//  - abordadoSGAS con mecanismo real y con vacío.
const data = {
  partes: [
    {
      parte: "Directorio",
      tipo: "interna",
      necesidadesExpectativas: ["Confianza de los grupos de interés.", "Involucramiento gerencial."],
      requisitos: ["Revisión periódica del desempeño."],
      esRequisitoLegal: true,
      influencia: "alta",
      seguimiento: "Revisión por la dirección",
      abordadoSGAS: "Revisión por la dirección (cláusula 9.3)",
    },
    {
      parte: "Proveedores",
      tipo: "{{+externa+}}",
      necesidadesExpectativas: "Transparencia en la contratación.",
      requisitos: "Cumplimiento del TUO de contrataciones.",
      esRequisitoLegal: false,
      influencia: "{{+media+}}",
      seguimiento: "Evaluación de proveedores",
      abordadoSGAS: "",
    },
  ],
} as unknown as Resultado;

test("datosPlantilla: enum con marca de cambio NO vacía el documento", () => {
  const d = datosPlantilla(data, perfil) as {
    internas: Array<Record<string, unknown>>;
    externas: Array<Record<string, unknown>>;
  };
  assert.equal(d.internas.length, 1);
  assert.equal(d.externas.length, 1, "'{{+externa+}}' debe clasificar como externa");
  assert.equal(d.externas[0].ambito, "EXTERNO");
});

test("datosPlantilla: el literal c) sale del modelo, nunca un 'Sí' fabricado", () => {
  const d = datosPlantilla(data, perfil) as { internas: Array<Record<string, unknown>>; externas: Array<Record<string, unknown>> };
  assert.equal(d.internas[0].aborda, "Revisión por la dirección (cláusula 9.3)");
  assert.equal(d.externas[0].aborda, "", "sin mecanismo → vacío, jamás 'Sí'");
});

test("datosPlantilla: listas reales por viñeta + tolerancia a string", () => {
  const d = datosPlantilla(data, perfil) as { internas: Array<Record<string, unknown>>; externas: Array<Record<string, unknown>> };
  assert.deepEqual(d.internas[0].necesidadesLista, [
    "Confianza de los grupos de interés.",
    "Involucramiento gerencial.",
  ]);
  // String donde el esquema pide arreglo → arreglo de 1, no crash.
  assert.deepEqual(d.externas[0].requisitosLista, ["Cumplimiento del TUO de contrataciones."]);
});

test("datosPlantilla: prioridad tolera influencia marcada", () => {
  const d = datosPlantilla(data, perfil) as { externas: Array<Record<string, unknown>> };
  assert.equal(d.externas[0].prioridad, "2", "'{{+media+}}' debe mapear a 2");
});

test("render: la columna del literal c) aparece solo si la norma la exige", () => {
  const md = render(data);
  assert.match(md, /Abordado mediante el sistema de gestión/);

  const sinAbordado = {
    partes: data.partes.map((p) => ({ ...p, abordadoSGAS: "" })),
  } as unknown as Resultado;
  assert.doesNotMatch(render(sinAbordado), /Abordado mediante el sistema de gestión/);
});

test("render: viñetas unidas con <br>, no fusionadas con punto y coma", () => {
  const md = render(data);
  assert.match(md, /Confianza de los grupos de interés\.<br>Involucramiento gerencial\./);
});

test("renderDocx: separa internas/externas y una viñeta por línea", () => {
  const spec = renderDocx(data, perfil);
  const [internas, externas] = spec.secciones;
  assert.match(internas.heading ?? "", /internas \(1\)/);
  assert.match(externas.heading ?? "", /externas \(1\)/);
  assert.equal(
    internas.tabla?.filas[0][1],
    "Confianza de los grupos de interés.\nInvolucramiento gerencial.",
    "las viñetas viajan como líneas dentro de la celda"
  );
});
