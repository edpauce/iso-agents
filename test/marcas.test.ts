import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarMarcasDeCambio, limpiarMarcas, VERDE, ROJO } from "../src/lib/docx/marcas.js";
import { extraerJson } from "../src/lib/anthropic.js";

/** Control de cambios dentro del XML de la plantilla del cliente. */

const run = (texto: string, rPr = '<w:rPr><w:sz w:val="18"/></w:rPr>') =>
  `<w:p><w:r>${rPr}<w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`;

test("marcas: {{+ +}} se colorea en verde y conserva las props del run", () => {
  const { xml, cambios } = aplicarMarcasDeCambio(run("Base {{+nuevo texto+}} fin"));
  assert.equal(cambios, 1);
  assert.match(xml, new RegExp(VERDE));
  assert.ok(!xml.includes("{{"), "las marcas no deben quedar en el XML");
  // El fragmento no marcado conserva su rPr original (sz=18).
  assert.ok(xml.includes('w:sz w:val="18"'), "conserva las propiedades del run");
});

test("marcas: {{- -}} sale en rojo tachado", () => {
  const { xml, cambios } = aplicarMarcasDeCambio(run("Queda {{-texto obsoleto-}} listo"));
  assert.equal(cambios, 1);
  assert.match(xml, new RegExp(ROJO));
  assert.match(xml, /<w:strike\/>/);
});

test("marcas: run con color previo lo reemplaza sin duplicar", () => {
  const { xml } = aplicarMarcasDeCambio(
    run("{{+agregado+}}", '<w:rPr><w:color w:val="000000"/><w:b/></w:rPr>')
  );
  const colores = xml.match(/<w:color [^>]*\/>/g) ?? [];
  assert.equal(colores.length, 1, "un solo w:color en el run marcado");
  assert.match(colores[0], new RegExp(VERDE));
});

test("marcas: un run sin marcas queda intacto", () => {
  const original = run("Texto normal del cliente");
  const { xml, cambios } = aplicarMarcasDeCambio(original);
  assert.equal(cambios, 0);
  assert.equal(xml, original);
});

test("limpiarMarcas: quita residuales conservando el contenido", () => {
  assert.equal(limpiarMarcas("a {{+b+}} c {{-d-}}"), "a b c d");
});

test("extraerJson: quita el fence solo si envuelve TODO el payload", () => {
  assert.equal(extraerJson('```json\n{"a":1}\n```'), '{"a":1}');
  // JSON con ``` DENTRO de un string no debe cortarse.
  const conFence = '{"doc":"usa ```bash``` adentro"}';
  assert.equal(extraerJson(conFence), conFence);
});
