import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registrarHerramienta } from "../../lib/herramienta.js";
import { normasTexto, type Perfil } from "../../lib/perfil.js";
import { lista } from "../../lib/render.js";
import type { DocSpec } from "../../lib/docx/casa.js";

interface Resultado {
  fortalezas: string[];
  oportunidades: string[];
  debilidades: string[];
  amenazas: string[];
  estrategias: { FO: string[]; FA: string[]; DO: string[]; DA: string[] };
}

const SYSTEM = `Eres un consultor auditor líder ISO experto en planificación estratégica de sistemas de gestión en Perú.

Tu tarea: construir el ANÁLISIS FODA (SWOT) que sustenta el requisito 4.1 del Anexo SL, y derivar la matriz cruzada de estrategias (FODA cruzado / TOWS).

Reglas de rigor:
- Fortalezas y Debilidades = internas (bajo control de la organización). Oportunidades y Amenazas = externas (del entorno).
- Cada ítem debe ser específico al sector, tamaño y realidad de la empresa; nada de frases genéricas de plantilla.
- Vincula el análisis a la capacidad de cumplir los resultados del SIG según las normas objetivo.
- Estrategias cruzadas:
  · FO (Ofensivas): usar fortalezas para aprovechar oportunidades.
  · FA (Defensivas): usar fortalezas para mitigar amenazas.
  · DO (Adaptativas): superar debilidades aprovechando oportunidades.
  · DA (Supervivencia): minimizar debilidades y evitar amenazas.
- 4 a 6 ítems por cuadrante FODA y 2 a 3 estrategias por cruce.

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "fortalezas": ["..."], "oportunidades": ["..."], "debilidades": ["..."], "amenazas": ["..."],
  "estrategias": { "FO": ["..."], "FA": ["..."], "DO": ["..."], "DA": ["..."] }
}
Sin texto fuera del JSON.`;

function render(data: Resultado): string {
  return [
    `El análisis FODA sintetiza las cuestiones internas (fortalezas y debilidades) y externas (oportunidades y amenazas) determinadas en 4.1, y orienta las acciones para abordar riesgos y oportunidades (6.1).`,
    ``,
    `### Fortalezas (F)`,
    lista(data.fortalezas),
    ``,
    `### Debilidades (D)`,
    lista(data.debilidades),
    ``,
    `### Oportunidades (O)`,
    lista(data.oportunidades),
    ``,
    `### Amenazas (A)`,
    lista(data.amenazas),
    ``,
    `## FODA cruzado — Estrategias (TOWS)`,
    `### Estrategias FO (Ofensivas — usar fortalezas para aprovechar oportunidades)`,
    lista(data.estrategias.FO),
    ``,
    `### Estrategias FA (Defensivas — usar fortalezas para enfrentar amenazas)`,
    lista(data.estrategias.FA),
    ``,
    `### Estrategias DO (Adaptativas — superar debilidades aprovechando oportunidades)`,
    lista(data.estrategias.DO),
    ``,
    `### Estrategias DA (Supervivencia — reducir debilidades y evitar amenazas)`,
    lista(data.estrategias.DA),
  ].join("\n");
}

export function registrarFoda(server: McpServer): void {
  registrarHerramienta<Resultado>(server, {
    nombre: "contexto_foda_4_1",
    title: "4.1 · Análisis FODA (con FODA cruzado)",
    descripcion:
      "Genera el Análisis FODA (SWOT) del requisito 4.1 y la matriz cruzada de estrategias (FO/FA/DO/DA · TOWS), específico al sector y a las normas objetivo. Admite documento del cliente (documentoCliente/documentoClientePath), modo generar|actualizar y formato casa|cliente.",
    tituloEntregable: "Análisis FODA",
    codigo: "4.1",
    clausula: "4.1 Comprensión de la organización y de su contexto",
    descripcionEntregable: "el Análisis FODA (SWOT) con su matriz cruzada de estrategias (TOWS)",
    systemCasa: SYSTEM,
    tarea: (p: Perfil) =>
      `Construye el análisis FODA y el FODA cruzado (requisito 4.1) para la organización descrita, alineado a ${normasTexto(
        p
      )}.`,
    render,
    renderDocx,
    datosPlantilla,
  });
}

const vinetas = (arr: string[]) => arr.map((x) => `• ${x}`).join("\n");
const items = (arr: string[]) => arr.map((x) => ({ item: x }));

function renderDocx(data: Resultado, p: Perfil): DocSpec {
  return {
    titulo: "Análisis FODA",
    empresa: p.nombre,
    requisito: "4.1 Comprensión de la organización y de su contexto",
    intro:
      "El análisis FODA sintetiza las cuestiones internas (fortalezas y debilidades) y externas (oportunidades y amenazas) del contexto, y orienta las acciones para abordar riesgos y oportunidades (6.1).",
    secciones: [
      {
        heading: "Matriz FODA",
        tabla: {
          headers: ["Origen interno", "Origen externo"],
          filas: [
            [`FORTALEZAS (F)\n${vinetas(data.fortalezas)}`, `OPORTUNIDADES (O)\n${vinetas(data.oportunidades)}`],
            [`DEBILIDADES (D)\n${vinetas(data.debilidades)}`, `AMENAZAS (A)\n${vinetas(data.amenazas)}`],
          ],
        },
      },
      {
        heading: "FODA cruzado — Estrategias (TOWS)",
        tabla: {
          headers: ["Cruce", "Estrategias"],
          filas: [
            ["FO (Ofensivas)", vinetas(data.estrategias.FO)],
            ["FA (Defensivas)", vinetas(data.estrategias.FA)],
            ["DO (Adaptativas)", vinetas(data.estrategias.DO)],
            ["DA (Supervivencia)", vinetas(data.estrategias.DA)],
          ],
        },
      },
    ],
  };
}

function datosPlantilla(data: Resultado, p: Perfil): Record<string, unknown> {
  return {
    empresa: p.nombre,
    codigo: "SIG-F-001",
    fortalezas: items(data.fortalezas),
    oportunidades: items(data.oportunidades),
    debilidades: items(data.debilidades),
    amenazas: items(data.amenazas),
    fo: items(data.estrategias.FO),
    fa: items(data.estrategias.FA),
    do: items(data.estrategias.DO),
    da: items(data.estrategias.DA),
  };
}
