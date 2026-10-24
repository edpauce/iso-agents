import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fragmentos,
  verificarFidelidad,
  quitarSeccionesMeta,
  formatearReporte,
} from "../src/lib/fidelidad.js";

/**
 * La guarda de fidelidad automatiza el diff origen→entregable que el
 * consultor corría a mano en el caso real de un cliente financiero: pérdidas de contenido del cliente y
 * adiciones no auditadas deben salir SOLAS en cada corrida.
 */

const ORIGEN = [
  "| GRUPO | REQUISITOS | EXPECTATIVAS |",
  "| --- | --- | --- |",
  "| DIRECTORIO | Revisión periódica del desempeño del sistema de gestión. | Incremento de la confianza en la entidad. / Involucramiento de la plana gerencial en los riesgos. |",
  "| SINDICATOS | Canales de denuncia y medidas de protección al denunciante. | Evaluación objetiva a los trabajadores sindicalizados. |",
].join("\n");

test("fidelidad: contenido conservado íntegro → 0 pérdidas", () => {
  const r = verificarFidelidad(ORIGEN, ORIGEN);
  assert.equal(r.perdidos.length, 0);
  assert.equal(r.nuevos.length, 0);
  assert.equal(r.conservados, r.total);
  assert.ok(r.total >= 5, "los ítems por celda cuentan por separado");
});

test("fidelidad: un ítem eliminado del origen se reporta como pérdida", () => {
  const salida = ORIGEN.replace(
    " / Involucramiento de la plana gerencial en los riesgos.",
    ""
  );
  const r = verificarFidelidad(ORIGEN, salida);
  assert.equal(r.perdidos.length, 1);
  assert.match(r.perdidos[0], /Involucramiento de la plana gerencial/);
});

test("fidelidad: una adición del modelo se reporta para auditoría", () => {
  const salida =
    ORIGEN +
    "\n| ESTADO | Gestión adecuada del riesgo climático en las operaciones crediticias. | Supervisión efectiva del sistema. |";
  const r = verificarFidelidad(ORIGEN, salida);
  assert.equal(r.perdidos.length, 0);
  assert.ok(r.nuevos.some((n) => /riesgo climático/.test(n)));
});

test("fidelidad: reformulación leve (acentos/mayúsculas/espacios) NO es pérdida", () => {
  const salida = ORIGEN.replace(
    "Revisión periódica del desempeño del sistema de gestión.",
    "REVISION  periodica del desempeño del sistema de gestión"
  );
  const r = verificarFidelidad(ORIGEN, salida);
  assert.equal(r.perdidos.length, 0);
});

test("fidelidad: las marcas de cambio no engañan a la comparación", () => {
  const salida = ORIGEN.replace(
    "Canales de denuncia y medidas de protección al denunciante.",
    "Canales de denuncia {{+y medidas de protección al denunciante+}}."
  );
  const r = verificarFidelidad(ORIGEN, salida);
  assert.equal(r.perdidos.length, 0, "la marca se limpia antes de comparar");
});

test("fidelidad: un ítem citado SOLO en 'Cambios realizados' sigue siendo pérdida", () => {
  const salida =
    ORIGEN.replace(
      "| SINDICATOS | Canales de denuncia y medidas de protección al denunciante. | Evaluación objetiva a los trabajadores sindicalizados. |",
      ""
    ) +
    "\n\n## Cambios realizados\n- Se retiró la fila de SINDICATOS: Canales de denuncia y medidas de protección al denunciante.";
  const r = verificarFidelidad(ORIGEN, salida);
  assert.ok(
    r.perdidos.some((p) => /Canales de denuncia/.test(p)),
    "citar la pérdida en la sección meta no la convierte en conservada"
  );
  // Y las líneas de la sección meta no aparecen como adiciones falsas.
  assert.ok(!r.nuevos.some((n) => /Se retiró la fila/.test(n)));
});

test("fidelidad: documento en prosa (sin tablas) cae a oraciones", () => {
  const politica =
    "La organización se compromete a prohibir el soborno en todas sus formas. " +
    "Los colaboradores deben reportar cualquier indicio por el canal de denuncias.";
  const frags = fragmentos(politica);
  assert.equal(frags.length, 2);

  const r = verificarFidelidad(politica, "La organización se compromete a prohibir el soborno en todas sus formas.");
  assert.equal(r.perdidos.length, 1);
  assert.match(r.perdidos[0], /canal de denuncias/);
});

test("fidelidad: fragmentos ignora encabezados, separadores y notas de extracción", () => {
  const frags = fragmentos(ORIGEN + "\n> NOTA DE EXTRACCIÓN: la celda está combinada sobre 26 filas.");
  assert.ok(!frags.some((f) => /NOTA DE EXTRACCIÓN|combinada sobre 26/.test(f)));
  assert.ok(!frags.some((f) => f === "GRUPO" || f === "REQUISITOS"));
});

test("fidelidad: los encabezados de columna del entregable no son adiciones", () => {
  const salida = [
    "| Parte interesada de la organización | Necesidades y expectativas pertinentes |",
    "| --- | --- |",
    "| DIRECTORIO | Revisión periódica del desempeño del sistema de gestión. |",
  ].join("\n");
  const r = verificarFidelidad("| G | R |\n| --- | --- |\n| DIRECTORIO | Revisión periódica del desempeño del sistema de gestión. |", salida);
  assert.equal(r.nuevos.length, 0, "las etiquetas de columna no cuentan como contenido nuevo");
});

test("fidelidad: el texto estático de la plantilla cuenta como conservado, nunca como adición", () => {
  const origen =
    "| A | B |\n| --- | --- |\n| MATRIZ DE GRUPOS DE INTERÉS DEL SISTEMA ANTISOBORNO | Revisión periódica del desempeño del sistema. |";
  const salida = "| G | R |\n| --- | --- |\n| DIRECTORIO | Revisión periódica del desempeño del sistema. |";
  const plantilla = "MATRIZ DE GRUPOS DE INTERÉS DEL SISTEMA ANTISOBORNO\nAlineada a la Norma Internacional ISO 37001:2025.";

  const sin = verificarFidelidad(origen, salida);
  assert.ok(sin.perdidos.some((p) => /MATRIZ DE GRUPOS/.test(p)), "sin contexto, el título figura perdido");

  const con = verificarFidelidad(origen, salida, { contextoSalida: plantilla });
  assert.equal(con.perdidos.length, 0, "con contexto de plantilla, el título cuenta como conservado");
  assert.ok(!con.nuevos.some((n) => /Alineada a la Norma/.test(n)), "el contexto no genera adiciones");
});

test("quitarSeccionesMeta: corta hasta el siguiente encabezado, no hasta el final", () => {
  const texto =
    "| A | contenido de la matriz uno dos tres. |\n\n## Cambios realizados\n- algo\n\n## Otra sección\ncontenido que debe sobrevivir a la limpieza";
  const limpio = quitarSeccionesMeta(texto);
  assert.ok(!limpio.includes("- algo"));
  assert.ok(limpio.includes("contenido que debe sobrevivir"));
});

test("formatearReporte: pérdidas en alto, listas truncadas a 10", () => {
  const r = {
    total: 30,
    conservados: 18,
    perdidos: Array.from({ length: 12 }, (_, i) => `Ítem perdido número ${i + 1} del documento original`),
    nuevos: [],
  };
  const s = formatearReporte(r);
  assert.match(s, /POSIBLES PÉRDIDAS del contenido original \(12\)/);
  assert.match(s, /18\/30 \(60%\)/);
  assert.match(s, /… y 2 más/);
  assert.match(s, /Sin adiciones/);
});
