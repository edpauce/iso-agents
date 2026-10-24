import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { extraerTexto } from "../src/lib/extract.js";
import { dirTemporal, docPatologiaCliente, docEtiquetaCombinada } from "./helpers.js";

/**
 * Congela el comportamiento ganado con el caso real de un cliente financiero: la extracción preserva la
 * REJILLA de las tablas (sin esto, el modelo inventaba celdas vacías y
 * completaba texto truncado — las dos fabricaciones de la sesión del 2026-07-08).
 */

test("extracción .docx: preserva la tabla como rejilla Markdown", async () => {
  const dir = await dirTemporal();
  const t = await extraerTexto(await docPatologiaCliente(dir));

  assert.ok(/^\|.*\|$/m.test(t), "debe producir filas de tabla Markdown");
  assert.match(t, /GRUPO DE INTERÉS/);
  assert.match(t, /SINDICATOS/);
  // El texto truncado del original llega TAL CUAL (la corrección es decisión
  // del modo actualizar, nunca de la extracción).
  assert.match(t, /vulnerado el sistema de\s*\|/);
});

test("extracción: celda combinada AMBIGUA (varios valores) emite NOTA y no adivina", async () => {
  const dir = await dirTemporal();
  const t = await extraerTexto(await docPatologiaCliente(dir));

  assert.match(t, /NOTA DE EXTRACCIÓN/);
  assert.match(t, /INTERNO \/ EXTERNO/);
  assert.match(t, /NO permite determinar/);
});

test("extracción: celda combinada de UN valor se repite por fila, sin aviso", async () => {
  const dir = await dirTemporal();
  const t = await extraerTexto(await docEtiquetaCombinada(dir));

  const filas = t.split("\n").filter((l) => l.startsWith("|") && !l.startsWith("| ---"));
  const conInterno = filas.filter((l) => l.includes("INTERNO"));
  assert.ok(conInterno.length >= 2, "la etiqueta INTERNO debe repetirse en ambas filas");
  assert.doesNotMatch(t, /NOTA DE EXTRACCIÓN/);
});

test("extracción: celda con varios párrafos se une con ' / ' (no se aplasta)", async () => {
  const dir = await dirTemporal();
  const t = await extraerTexto(await docPatologiaCliente(dir));

  assert.match(t, /Incremento de la confianza\. \/ Involucramiento de la plana gerencial\./);
});

test("extracción: sin imágenes base64 en la salida", async () => {
  const dir = await dirTemporal();
  const t = await extraerTexto(await docPatologiaCliente(dir));
  assert.ok(!t.includes("base64"), "no debe filtrar imágenes embebidas");
});

test("extracción: .txt y .md pasan directo; formatos no soportados fallan claro", async () => {
  const dir = await dirTemporal();
  const txt = path.join(dir, "nota.txt");
  await writeFile(txt, "  contenido plano  ");
  assert.equal(await extraerTexto(txt), "contenido plano");

  await assert.rejects(() => extraerTexto(path.join(dir, "algo.rtf")), /Formato no soportado/);
  await assert.rejects(() => extraerTexto(path.join(dir, "algo.pdf")), /PDF por ruta/);
});
