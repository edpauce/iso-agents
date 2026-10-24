import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registrarHerramienta } from "../../lib/herramienta.js";
import { normasTexto, type Perfil } from "../../lib/perfil.js";
import { tablaMarkdown } from "../../lib/render.js";
import type { DocSpec } from "../../lib/docx/casa.js";

type Dimension = "Político" | "Económico" | "Social" | "Tecnológico" | "Ecológico" | "Legal";
const ORDEN: Dimension[] = [
  "Político",
  "Económico",
  "Social",
  "Tecnológico",
  "Ecológico",
  "Legal",
];

interface Factor {
  dimension: Dimension;
  factor: string;
  tipo: "oportunidad" | "amenaza" | "neutro";
  descripcion: string;
  implicancia: string;
}
interface Resultado {
  factores: Factor[];
}

const SYSTEM = `Eres un consultor auditor líder ISO experto en análisis del entorno para sistemas de gestión en Perú.

Tu tarea: construir el ANÁLISIS PESTEL de las cuestiones EXTERNAS que sustentan el requisito 4.1 del Anexo SL.

Dimensiones (usa exactamente estos nombres): Político, Económico, Social, Tecnológico, Ecológico, Legal.
Reglas de rigor:
- Ancla los factores a la realidad PERUANA y al sector de la empresa (política/regulación local, macroeconomía, demografía y cultura, tecnología del rubro, condiciones ambientales, marco legal aplicable).
- En "Legal" y "Ecológico" cita normativa peruana pertinente a las normas objetivo cuando aplique (ej. Ley 29783 y su reglamento para SST; Ley General del Ambiente 28611 y fiscalización OEFA para ambiental; protección al consumidor/Indecopi para calidad).
- Clasifica cada factor como oportunidad, amenaza o neutro para el SIG, con su implicancia concreta.
- 2 a 4 factores por dimensión.

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "factores": [
    { "dimension": "Político"|"Económico"|"Social"|"Tecnológico"|"Ecológico"|"Legal", "factor": "string", "tipo": "oportunidad"|"amenaza"|"neutro", "descripcion": "string", "implicancia": "string" }
  ]
}
Sin texto fuera del JSON.`;

function render(data: Resultado): string {
  const secciones = ORDEN.map((dim) => {
    const factores = data.factores.filter((f) => f.dimension === dim);
    if (!factores.length) return "";
    const filas = factores.map((f) => [f.factor, f.tipo, f.descripcion, f.implicancia]);
    return [
      `### ${dim}`,
      tablaMarkdown(["Factor", "Tipo", "Descripción", "Implicancia para el SIG"], filas),
    ].join("\n");
  })
    .filter(Boolean)
    .join("\n\n");

  return [
    `El análisis PESTEL identifica los factores del entorno (cuestiones externas de 4.1) que pueden afectar los resultados del sistema de gestión. Alimenta el cuadrante de Oportunidades y Amenazas del FODA y la evaluación de riesgos y oportunidades (6.1).`,
    ``,
    secciones,
  ].join("\n");
}

function renderDocx(data: Resultado, p: Perfil): DocSpec {
  const secciones = ORDEN.map((dim) => {
    const fs = data.factores.filter((f) => f.dimension === dim);
    if (!fs.length) return null;
    return {
      heading: dim,
      tabla: {
        headers: ["Factor", "Tipo", "Descripción", "Implicancia para el SIG"],
        filas: fs.map((f) => [f.factor, f.tipo, f.descripcion, f.implicancia]),
      },
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);
  return {
    titulo: "Análisis PESTEL del Entorno",
    empresa: p.nombre,
    requisito: "4.1 Comprensión de la organización y de su contexto",
    intro:
      "El análisis PESTEL identifica los factores del entorno (cuestiones externas de 4.1) que pueden afectar los resultados del sistema de gestión.",
    secciones,
  };
}

function datosPlantilla(data: Resultado, p: Perfil): Record<string, unknown> {
  return {
    empresa: p.nombre,
    codigo: "SIG-F-003",
    factores: data.factores.map((f) => ({
      dimension: f.dimension,
      factor: f.factor,
      tipo: f.tipo,
      descripcion: f.descripcion,
      implicancia: f.implicancia,
    })),
  };
}

export function registrarPestel(server: McpServer): void {
  registrarHerramienta<Resultado>(server, {
    nombre: "contexto_pestel_4_1",
    title: "4.1 · Análisis PESTEL del entorno",
    descripcion:
      "Genera el Análisis PESTEL (Político, Económico, Social, Tecnológico, Ecológico, Legal) de las cuestiones externas del requisito 4.1, anclado al marco peruano y al sector. Admite documento del cliente (documentoCliente/documentoClientePath), modo generar|actualizar y formato casa|cliente.",
    tituloEntregable: "Análisis PESTEL del Entorno",
    codigo: "4.1",
    clausula: "4.1 Comprensión de la organización y de su contexto",
    descripcionEntregable: "el Análisis PESTEL del entorno (Político, Económico, Social, Tecnológico, Ecológico, Legal)",
    systemCasa: SYSTEM,
    tarea: (p: Perfil) =>
      `Construye el análisis PESTEL del entorno (requisito 4.1) para la organización descrita, alineado a ${normasTexto(
        p
      )}.`,
    render,
    renderDocx,
    datosPlantilla,
  });
}
