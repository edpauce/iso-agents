/** Helpers de render a Markdown (los entregables se entregan como documento pegable en Word). */

/** Escapa `|` para que no rompa las celdas de una tabla Markdown. */
function celda(v: unknown): string {
  return String(v ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, " ")
    .trim();
}

/** Construye una tabla Markdown a partir de encabezados y filas. */
export function tablaMarkdown(headers: string[], filas: unknown[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = filas.map((f) => `| ${f.map(celda).join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

/** Lista con viñetas; ignora entradas vacías. */
export function lista(items: string[]): string {
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `- ${s}`)
    .join("\n");
}

/**
 * Envuelve el documento con una cabecera estándar de entregable EHSQ y anexa
 * el JSON estructurado (en un fence) para que el host/otras tools lo reusen.
 */
export function entregable(args: {
  titulo: string;
  clausula: string;
  empresa: string;
  cuerpo: string;
  datos: unknown;
}): string {
  const { titulo, clausula, empresa, cuerpo, datos } = args;
  return [
    `# ${titulo}`,
    ``,
    `**Empresa:** ${empresa}  `,
    `**Requisito:** ${clausula}`,
    ``,
    cuerpo.trim(),
    ``,
    `---`,
    `<details><summary>Datos estructurados (JSON — para reuso entre herramientas)</summary>`,
    ``,
    "```json",
    JSON.stringify(datos, null, 2),
    "```",
    ``,
    `</details>`,
  ].join("\n");
}
