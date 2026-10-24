import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { cargarTextoNormativo, tituloOficial } from "../src/lib/normas.js";

/**
 * Congela la base normativa: el texto OFICIAL prevalece, la edición vigente de
 * 37001 es la 2025 (con el literal c) nuevo), y los títulos difieren por norma.
 *
 * Corre contra `test/fixtures/normas/`: sustitutos SINTÉTICOS con la misma
 * estructura que los archivos oficiales. El texto oficial ISO tiene derechos
 * de autor y no se versiona; cada usuario lo deja en su `normas/` local.
 */
const FIXTURES = fileURLToPath(new URL("./fixtures/normas", import.meta.url));

test("normativa: 37001/4.2 es la edición 2025 y trae el literal c)", async () => {
  const t = await cargarTextoNormativo("4.2", ["37001"], FIXTURES);
  assert.match(t, /TEXTO OFICIAL/);
  assert.match(t, /37001:2025/);
  assert.match(t, /se abordarán mediante el sistema de gestión antisoborno/);
  assert.match(t, /cambio climático/);
});

test("normativa: títulos oficiales difieren por norma (Conocimiento vs Comprensión)", async () => {
  assert.equal(
    await tituloOficial("4.1", ["9001"], FIXTURES),
    "4.1 Conocimiento de la organización y de su contexto"
  );
  assert.equal(
    await tituloOficial("4.1", ["45001"], FIXTURES),
    "4.1 Comprensión de la organización y de su contexto"
  );
  assert.match((await tituloOficial("4.2", ["45001"], FIXTURES)) ?? "", /trabajadores/);
  assert.match((await tituloOficial("4.3", ["9001"], FIXTURES)) ?? "", /de la calidad$/);
});

test("normativa: 4.5 existe solo en 37001; sin archivo → null/vacío, sin inventar", async () => {
  assert.match((await tituloOficial("4.5", ["37001"], FIXTURES)) ?? "", /riesgo de soborno/);
  assert.equal(await tituloOficial("4.5", ["9001"], FIXTURES), null);
  assert.equal(await cargarTextoNormativo("4.5", ["9001"], FIXTURES), "");
});

test("normativa: sin texto oficial cae a la guía común marcada como paráfrasis", async () => {
  // 27001 no tiene carpeta: debe caer a comun/4.1.md
  const t = await cargarTextoNormativo("4.1", ["27001"], FIXTURES);
  assert.match(t, /Guía del requisito 4\.1/);
  assert.match(t, /paráfrasis, no oficial/);
});
