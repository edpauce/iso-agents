import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { extraerTexto } from "./extract.js";

/**
 * Carga la REFERENCIA NORMATIVA de un requisito (ej. "4.2") para las normas
 * objetivo, desde la carpeta `normas/`. El texto se inyecta en el prompt para
 * que la herramienta se ciña EXACTAMENTE a lo que pide la norma (y no de más).
 *
 * Convención de archivos (el primero que exista, por extensión .md/.txt/.docx):
 *   normas/comun/<codigo>.md     → guía del Anexo SL común a 9001/14001/45001
 *   normas/<norma>/<codigo>.md   → texto oficial específico de esa norma
 * Ej.: normas/comun/4.2.md, normas/9001/4.2.md, normas/45001/4.2.docx
 *
 * La raíz se resuelve junto al proyecto (o vía NORMAS_DIR); las funciones
 * aceptan una raíz explícita para apuntar a otra carpeta (p. ej. fixtures).
 */
const RAIZ = process.env.NORMAS_DIR
  ? path.resolve(process.env.NORMAS_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../normas");

const EXTENSIONES = [".md", ".txt", ".markdown", ".docx"] as const;

async function leerSiExiste(dir: string, codigo: string): Promise<string | null> {
  for (const ext of EXTENSIONES) {
    const archivo = path.join(dir, `${codigo}${ext}`);
    try {
      if (ext === ".docx") {
        const t = await extraerTexto(archivo);
        if (t.trim()) return t.trim();
      } else {
        const t = await readFile(archivo, "utf8");
        if (t.trim()) return t.trim();
      }
    } catch {
      // No existe / no legible: probar siguiente extensión.
    }
  }
  return null;
}

/**
 * Devuelve el bloque de referencia normativa del requisito para las normas
 * objetivo. El TEXTO OFICIAL prevalece: si existe al menos un archivo oficial
 * (normas/<norma>/<codigo>.*) para las normas pedidas, se usa(n) ése(os) y NO se
 * mezcla la guía parafraseada (evita contradicciones de título/redacción). Solo
 * cuando no hay ningún oficial se cae a la guía común (normas/comun/<codigo>.*).
 */
export async function cargarTextoNormativo(
  codigo: string,
  normas: string[],
  raiz: string = RAIZ
): Promise<string> {
  const oficiales: string[] = [];
  for (const n of normas) {
    const t = await leerSiExiste(path.join(raiz, n), codigo);
    if (t) oficiales.push(`[ISO ${n} — requisito ${codigo}, TEXTO OFICIAL]\n${t}`);
  }
  if (oficiales.length) return oficiales.join("\n\n");

  const comun = await leerSiExiste(path.join(raiz, "comun"), codigo);
  if (comun) return `[Guía del requisito ${codigo} — Anexo SL, común (paráfrasis, no oficial)]\n${comun}`;

  return "";
}

/**
 * Título OFICIAL del requisito según la primera norma objetivo que lo tenga
 * (los títulos difieren: 9001/14001 dicen "Conocimiento…", 45001 "Comprensión…").
 * Se lee de la línea `## <codigo> <título>` del archivo normativo.
 * Devuelve null si no hay archivo oficial; el llamador usa su etiqueta genérica.
 */
export async function tituloOficial(
  codigo: string,
  normas: string[],
  raiz: string = RAIZ
): Promise<string | null> {
  for (const n of normas) {
    const t = await leerSiExiste(path.join(raiz, n), codigo);
    if (!t) continue;
    const esc = codigo.replace(/\./g, "\\.");
    const m = t.match(new RegExp(`^##\\s*${esc}\\s+(.+)$`, "m"));
    if (m) return `${codigo} ${m[1].trim()}`;
  }
  return null;
}
