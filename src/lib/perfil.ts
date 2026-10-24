import { z } from "zod";

/**
 * Perfil de empresa COMPARTIDO por todas las herramientas (igual que el perfil
 * compartido de NORMA). Es el input mínimo para que cualquier entregable del
 * SIG se genere aterrizado en la realidad del cliente.
 *
 * Se expone como "raw shape" para reusarlo en el inputSchema de cada tool MCP.
 */
export const perfilShape = {
  nombre: z.string().describe("Razón social o nombre de la empresa."),
  sector: z.string().describe("Sector / rubro económico (ej. 'Distribución de energía eléctrica')."),
  tamano: z
    .string()
    .optional()
    .describe("Tamaño o nº de trabajadores (texto libre, admite rangos: '51-200')."),
  productosServicios: z
    .string()
    .optional()
    .describe("Productos y servicios principales de la organización."),
  procesos: z
    .array(z.string())
    .optional()
    .describe("Procesos principales de la organización."),
  ubicacion: z
    .string()
    .optional()
    .describe("País / región de operación. Por defecto se asume Perú (marco legal peruano)."),
  normas: z
    .array(z.enum(["9001", "14001", "45001", "37001"]))
    .optional()
    .describe(
      "Normas ISO objetivo del sistema de gestión. Por defecto ISO 9001. Usa 37001 para sistemas de gestión antisoborno (SGAS)."
    ),
  material: z
    .string()
    .optional()
    .describe(
      "Material fuente OPCIONAL: texto extraído de documentos reales del cliente (políticas, actas, informes) para fundamentar la generación (grounding)."
    ),
};

export const PerfilSchema = z.object(perfilShape);
export type Perfil = z.infer<typeof PerfilSchema>;

const NOMBRE_NORMA: Record<string, string> = {
  "9001": "ISO 9001:2015 (Calidad)",
  "14001": "ISO 14001:2015 (Ambiental)",
  "45001": "ISO 45001:2018 (SST)",
  "37001": "ISO 37001:2025 (Antisoborno · SGAS, 2ª edición)",
};

/** Lista legible de normas objetivo (default: solo 9001). */
export function normasTexto(p: Perfil): string {
  const normas = p.normas && p.normas.length ? p.normas : ["9001"];
  return normas.map((n) => NOMBRE_NORMA[n] ?? n).join(", ");
}

/** Bloque de texto con el perfil, listo para inyectar en el prompt del usuario. */
export function perfilResumen(p: Perfil): string {
  const lineas: string[] = [
    `- Empresa: ${p.nombre}`,
    `- Sector: ${p.sector}`,
    `- Ubicación: ${p.ubicacion?.trim() || "Perú"}`,
    `- Normas objetivo del SIG: ${normasTexto(p)}`,
  ];
  if (p.tamano?.trim()) lineas.push(`- Tamaño: ${p.tamano.trim()}`);
  if (p.productosServicios?.trim())
    lineas.push(`- Productos/servicios: ${p.productosServicios.trim()}`);
  if (p.procesos && p.procesos.length)
    lineas.push(`- Procesos principales:\n${p.procesos.map((x) => `    · ${x}`).join("\n")}`);
  if (p.material?.trim())
    lineas.push(
      `\nMATERIAL FUENTE DEL CLIENTE (usa esto como base factual; no lo contradigas):\n"""\n${p.material.trim()}\n"""`
    );
  return lineas.join("\n");
}
