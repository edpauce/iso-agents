import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

/** Carpeta de salidas por defecto: <proyecto>/salidas (o SALIDAS_DIR). */
const RAIZ = process.env.SALIDAS_DIR
  ? path.resolve(process.env.SALIDAS_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../salidas");

function expandir(ruta: string): string {
  if (ruta === "~") return os.homedir();
  if (ruta.startsWith("~/")) return path.join(os.homedir(), ruta.slice(2));
  return ruta;
}

/** slug seguro para nombre de archivo. */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Escribe el .docx. `salidaPath` puede ser una carpeta o una ruta de archivo
 * (.docx); si se omite, usa la carpeta de salidas del proyecto. Devuelve la
 * ruta absoluta escrita.
 */
export async function escribirDocx(
  nombreBase: string,
  buf: Buffer,
  salidaPath?: string
): Promise<string> {
  let destino: string;
  if (salidaPath && salidaPath.trim()) {
    const p = expandir(salidaPath.trim());
    destino = p.toLowerCase().endsWith(".docx") ? p : path.join(p, `${nombreBase}.docx`);
  } else {
    destino = path.join(RAIZ, `${nombreBase}.docx`);
  }
  // Siempre absoluta: la ruta se le devuelve al usuario para abrir el archivo.
  destino = path.resolve(destino);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, buf);
  return destino;
}
