/**
 * Convierte un .md (entregable ya generado) a .docx, sin llamar a la API.
 *
 *   npx tsx scripts/md-a-docx.ts <entrada.md> <salida.docx> "<titulo>" "<empresa>" "<requisito>"
 */
import { readFile, writeFile } from "node:fs/promises";
import { mdADocx } from "../src/lib/docx/markdown.js";

const [, , entrada, salida, titulo, empresa, requisito] = process.argv;

if (!entrada || !salida) {
  console.error("Uso: tsx scripts/md-a-docx.ts <entrada.md> <salida.docx> [titulo] [empresa] [requisito]");
  process.exit(1);
}

const md = await readFile(entrada, "utf8");
const buf = await mdADocx(md, {
  titulo: titulo ?? "Entregable",
  empresa: empresa ?? "—",
  requisito: requisito ?? "—",
});
await writeFile(salida, buf);
console.log("Word escrito en:", salida);
