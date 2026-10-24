import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registrarHerramienta } from "../../lib/herramienta.js";
import { normasTexto, type Perfil } from "../../lib/perfil.js";
import { tablaMarkdown } from "../../lib/render.js";
import type { DocSpec } from "../../lib/docx/casa.js";

interface Cuestion {
  tipo: "interna" | "externa";
  categoria: string;
  cuestion: string;
  tendencia: "favorable" | "adversa" | "neutra";
  impacto: string;
  fodaRelacion: "F" | "O" | "D" | "A";
}
interface Resultado {
  cuestiones: Cuestion[];
}

const SYSTEM = `Eres un consultor auditor líder ISO con 15 años de experiencia en Perú, experto en el Anexo SL (estructura de alto nivel común a ISO 9001, 14001 y 45001).

Tu tarea: determinar las CUESTIONES INTERNAS Y EXTERNAS pertinentes para el propósito y dirección estratégica de la organización, según el requisito 4.1 "Comprensión de la organización y de su contexto".

Reglas de rigor:
- Cuestiones EXTERNAS: derívalas del entorno — categorías tipo PESTEL (político-legal, económico, social-cultural, tecnológico, ambiental/ecológico) más mercado/competencia y partes interesadas externas. Ancla lo legal al marco PERUANO (ej. Ley 29783 SST, normativa ambiental del MINAM, OEFA, Indecopi, Sunafil) cuando aplique a las normas objetivo.
- Cuestiones INTERNAS: gobernanza y estructura, recursos y capacidades, conocimiento y competencia del personal, cultura y clima, infraestructura y tecnología, desempeño de procesos, situación financiera.
- Cada cuestión debe ser ESPECÍFICA al sector y realidad de la empresa, no genérica.
- Marca la tendencia (favorable/adversa/neutra) y su impacto potencial concreto en el SIG.
- Relaciona cada cuestión con el cuadrante FODA que alimenta: F (interna+favorable), D (interna+adversa), O (externa+favorable), A (externa+adversa).
- Genera entre 12 y 20 cuestiones, balanceadas entre internas y externas.

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "cuestiones": [
    { "tipo": "interna"|"externa", "categoria": "string", "cuestion": "string", "tendencia": "favorable"|"adversa"|"neutra", "impacto": "string", "fodaRelacion": "F"|"O"|"D"|"A" }
  ]
}
Sin texto fuera del JSON.`;

function render(data: Resultado): string {
  const internas = data.cuestiones.filter((c) => c.tipo === "interna");
  const externas = data.cuestiones.filter((c) => c.tipo === "externa");
  const headers = ["Categoría", "Cuestión", "Tendencia", "Impacto potencial en el SIG", "FODA"];
  const filas = (cs: Cuestion[]) =>
    cs.map((c) => [c.categoria, c.cuestion, c.tendencia, c.impacto, c.fodaRelacion]);
  return [
    `Se determinan las cuestiones internas y externas que afectan la capacidad de la organización para lograr los resultados previstos de su sistema de gestión. Se revisan periódicamente y alimentan el análisis FODA (4.1) y la matriz de partes interesadas (4.2).`,
    ``,
    `## Cuestiones internas (${internas.length})`,
    tablaMarkdown(headers, filas(internas)),
    ``,
    `## Cuestiones externas (${externas.length})`,
    tablaMarkdown(headers, filas(externas)),
  ].join("\n");
}

const HEADERS = ["Categoría", "Cuestión", "Tendencia", "Impacto potencial en el SIG", "FODA"];

function renderDocx(data: Resultado, p: Perfil): DocSpec {
  const filas = (t: "interna" | "externa") =>
    data.cuestiones
      .filter((c) => c.tipo === t)
      .map((c) => [c.categoria, c.cuestion, c.tendencia, c.impacto, c.fodaRelacion]);
  return {
    titulo: "Matriz de Contexto de la Organización",
    empresa: p.nombre,
    requisito: "4.1 Comprensión de la organización y de su contexto",
    intro:
      "Se determinan las cuestiones internas y externas que afectan la capacidad de la organización para lograr los resultados previstos de su sistema de gestión.",
    secciones: [
      { heading: "Cuestiones internas", tabla: { headers: HEADERS, filas: filas("interna") } },
      { heading: "Cuestiones externas", tabla: { headers: HEADERS, filas: filas("externa") } },
    ],
  };
}

function datosPlantilla(data: Resultado, p: Perfil): Record<string, unknown> {
  return {
    empresa: p.nombre,
    codigo: "SIG-F-001",
    cuestiones: data.cuestiones.map((c) => ({
      tipo: c.tipo,
      categoria: c.categoria,
      cuestion: c.cuestion,
      tendencia: c.tendencia,
      impacto: c.impacto,
      foda: c.fodaRelacion,
    })),
  };
}

export function registrarCuestiones(server: McpServer): void {
  registrarHerramienta<Resultado>(server, {
    nombre: "contexto_cuestiones_4_1",
    title: "4.1 · Matriz de cuestiones internas y externas",
    descripcion:
      "Genera la Matriz de Contexto (cuestiones internas y externas) del requisito 4.1 del Anexo SL (ISO 9001/14001/45001), aterrizada al sector y al marco legal peruano. Admite documento del cliente (documentoCliente/documentoClientePath), modo generar|actualizar y formato casa|cliente.",
    tituloEntregable: "Matriz de Contexto de la Organización",
    codigo: "4.1",
    clausula: "4.1 Comprensión de la organización y de su contexto",
    descripcionEntregable: "la Matriz de cuestiones internas y externas del contexto de la organización",
    systemCasa: SYSTEM,
    tarea: (p: Perfil) =>
      `Determina las cuestiones internas y externas (requisito 4.1) para la organización descrita, alineadas a ${normasTexto(
        p
      )}.`,
    render,
    renderDocx,
    datosPlantilla,
  });
}
