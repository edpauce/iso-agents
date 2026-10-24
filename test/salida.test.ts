import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { stat } from "node:fs/promises";
import { slug, escribirDocx } from "../src/lib/docx/salida.js";
import { dirTemporal } from "./helpers.js";

test("slug: sin acentos, sin espacios, apto para nombre de archivo", () => {
  assert.equal(slug("Determinación del Alcance — SGC"), "determinacion-del-alcance-sgc");
  assert.equal(slug("Matriz de Partes Interesadas"), "matriz-de-partes-interesadas");
});

test("escribirDocx: siempre devuelve ruta ABSOLUTA y escribe el archivo", async () => {
  const dir = await dirTemporal();
  const ruta = await escribirDocx("prueba", Buffer.from("contenido"), dir);
  assert.ok(path.isAbsolute(ruta), "la ruta devuelta debe ser absoluta");
  assert.ok(ruta.endsWith("prueba.docx"));
  assert.ok((await stat(ruta)).size > 0);

  // Si salidaPath ya es un .docx, se respeta tal cual.
  const directa = await escribirDocx("ignorado", Buffer.from("x"), path.join(dir, "final.docx"));
  assert.ok(directa.endsWith("final.docx"));
});
