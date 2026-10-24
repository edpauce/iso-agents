import { z } from "zod";
import { extraerTexto } from "./extract.js";

/**
 * Opciones de grounding y plantilla, COMUNES a todas las herramientas de
 * generación de entregables. Controlan tres cosas:
 *  · de dónde sale la base (documento del cliente, por texto o por ruta),
 *  · el modo de trabajo (generar de cero vs actualizar lo existente),
 *  · el formato de salida (plantilla casa vs replicar el formato del cliente).
 */
export const opcionesShape = {
  documentoCliente: z
    .string()
    .optional()
    .describe(
      "Texto del documento VIGENTE del cliente (matriz previa, política, acta, FODA anterior). Base para grounding, actualización o para replicar su formato."
    ),
  documentoClientePath: z
    .string()
    .optional()
    .describe(
      "Ruta local a un documento del cliente (.docx/.txt/.md) que el servidor leerá y usará como base. Alternativa a documentoCliente."
    ),
  modo: z
    .enum(["generar", "actualizar"])
    .optional()
    .describe(
      "generar = crear de cero con la metodología casa (default). actualizar = partir del documento del cliente, conservar lo correcto y actualizarlo/reforzarlo a la versión vigente de la norma. 'actualizar' requiere un documento."
    ),
  formato: z
    .enum(["casa", "cliente"])
    .optional()
    .describe(
      "casa = plantilla estándar de la casa (default). cliente = replicar la estructura, columnas, escala y metodología del documento del cliente. 'cliente' requiere un documento."
    ),
  exportarDocx: z
    .boolean()
    .optional()
    .describe(
      "Si es true, además del Markdown genera un archivo Word (.docx) con formato casa (tablas y colores) y devuelve su ruta para abrirlo en Word."
    ),
  plantillaPath: z
    .string()
    .optional()
    .describe(
      "Ruta a una PLANTILLA .docx del cliente con marcadores docxtemplater ({campo}, {#bucle}…{/bucle}). Si se da, rellena esa plantilla conservando su formato visual EXACTO (colores, bordes, logo) y devuelve la ruta del .docx generado."
    ),
  salidaPath: z
    .string()
    .optional()
    .describe(
      "Carpeta o ruta de archivo .docx donde escribir la salida. Por defecto: carpeta 'salidas/' del proyecto."
    ),
};

export const OpcionesSchema = z.object(opcionesShape);
export type Opciones = z.infer<typeof OpcionesSchema>;

export type Modo = "generar" | "actualizar";
export type Formato = "casa" | "cliente";

/** Resuelve el texto base del cliente desde texto inline o ruta local. */
export async function resolverDocumento(o: Opciones): Promise<string | null> {
  if (o.documentoCliente?.trim()) return o.documentoCliente.trim();
  if (o.documentoClientePath?.trim()) return await extraerTexto(o.documentoClientePath);
  return null;
}

/** Límite defensivo de tamaño del documento inyectado en el prompt. */
const MAX_DOC = 24000;

/** Bloque de prompt con el documento del cliente, según el modo. */
export function bloqueDocumento(doc: string, modo: Modo): string {
  const recortado = doc.length > MAX_DOC ? doc.slice(0, MAX_DOC) + "\n…[documento recortado]" : doc;
  const rol =
    modo === "actualizar"
      ? "Es la versión VIGENTE a actualizar; consérvala como base y no inventes que contenía algo que no está."
      : "Úsalo como base factual; no lo contradigas.";
  return `\n\nDOCUMENTO DEL CLIENTE (${rol}):\n"""\n${recortado}\n"""`;
}

/** Fragmento de system prompt para el modo actualizar (formato casa). */
export const INSTRUCCION_ACTUALIZAR = `

MODO ACTUALIZACIÓN: el usuario adjunta el documento VIGENTE del cliente. Se conserva su FORMATO, no se recorta su CONTENIDO. Trabaja así:

1. CONSERVA todas las entradas del documento, una por una y con su redacción original. No las fusiones, no las resumas y no elimines ninguna. Si una celda tenía 6 viñetas, devuelve 6 entradas. Tampoco elimines partes interesadas.
2. CORRIGE lo obsoleto frente a la versión vigente de la(s) norma(s) objetivo (referencias a ediciones anteriores, texto truncado, erratas), sin alterar el sentido.
3. AGREGA lo que el requisito EXIGE y el documento no tiene: entradas nuevas, partes interesadas faltantes, o el contenido de requisitos nuevos de la versión vigente (p. ej. el cambio climático como cuestión o expectativa pertinente). Ubícalo en la parte interesada que corresponda.
4. También AGREGA, cuando la norma lo pida, lo que el formato del cliente no cubre. Resuelve la brecha dentro del documento en vez de solo señalarla.

Sobre "no hacer de más": esa regla prohíbe inventar elementos que la norma NO pide. NO te autoriza a omitir lo que la norma SÍ exige, ni a recortar el contenido existente del cliente.

Devuelve el mismo esquema JSON de la metodología casa, ya actualizado e integrado.`;
