import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registrarHerramienta } from "../../lib/herramienta.js";
import { normasTexto, type Perfil } from "../../lib/perfil.js";
import { lista, tablaMarkdown } from "../../lib/render.js";
import type { DocSpec, DocSeccion } from "../../lib/docx/casa.js";

interface Exclusion {
  requisito: string;
  justificacion: string;
}
interface Resultado {
  declaracionAlcance: string;
  productosServicios: string[];
  sedes: string[];
  unidades: string[];
  procesosIncluidos: string[];
  exclusiones: Exclusion[];
}

const SYSTEM = `Eres un consultor auditor líder ISO con experiencia en Perú, experto en el Anexo SL.

Tu tarea: redactar la DETERMINACIÓN DEL ALCANCE del sistema de gestión, según el requisito 4.3.

Reglas de rigor:
- La "declaracionAlcance" es el párrafo formal, disponible como información documentada, que describe qué cubre el SIG: productos y servicios, y límites físicos y organizacionales.
- Determina el alcance considerando las cuestiones de 4.1, los requisitos de las partes interesadas (4.2) y los productos/servicios de la organización.
- sedes = límites físicos (ubicaciones/instalaciones incluidas). unidades = límites organizacionales (áreas/unidades de negocio incluidas).
- EXCLUSIONES: solo ISO 9001 admite requisitos "no aplicables" (típicamente de la cláusula 8), y solo si no afectan la capacidad de dar productos/servicios conformes; cada exclusión debe llevar justificación. ISO 14001 e ISO 45001 NO permiten excluir requisitos. Si las normas objetivo no incluyen 9001, deja "exclusiones" como arreglo vacío.
- No excluyas nada solo por conveniencia; una exclusión sin justificación válida es un hallazgo.

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "declaracionAlcance": "string",
  "productosServicios": ["..."],
  "sedes": ["..."],
  "unidades": ["..."],
  "procesosIncluidos": ["..."],
  "exclusiones": [ { "requisito": "string", "justificacion": "string" } ]
}
Sin texto fuera del JSON.`;

function render(data: Resultado): string {
  const bloques: string[] = [
    `El alcance define los límites y la aplicabilidad del sistema de gestión y se mantiene como información documentada. Se determinó considerando las cuestiones internas y externas (4.1), los requisitos de las partes interesadas (4.2) y los productos y servicios de la organización.`,
    ``,
    `## Declaración de alcance`,
    `> ${data.declaracionAlcance.trim()}`,
    ``,
    `## Productos y servicios cubiertos`,
    lista(data.productosServicios),
    ``,
    `## Límites físicos (sedes / instalaciones)`,
    lista(data.sedes),
    ``,
    `## Límites organizacionales (unidades / áreas)`,
    lista(data.unidades),
    ``,
    `## Procesos incluidos`,
    lista(data.procesosIncluidos),
  ];
  if (data.exclusiones && data.exclusiones.length) {
    bloques.push(
      ``,
      `## Requisitos no aplicables (solo ISO 9001) y su justificación`,
      tablaMarkdown(
        ["Requisito", "Justificación de no aplicabilidad"],
        data.exclusiones.map((e) => [e.requisito, e.justificacion])
      )
    );
  } else {
    bloques.push(``, `## Requisitos no aplicables`, `_No se declaran exclusiones._`);
  }
  return bloques.join("\n");
}

export function registrarAlcance(server: McpServer): void {
  registrarHerramienta<Resultado>(server, {
    nombre: "contexto_alcance_4_3",
    title: "4.3 · Determinación del alcance del SIG",
    descripcion:
      "Redacta la Determinación del Alcance del requisito 4.3 (declaración formal + límites físicos y organizacionales + procesos; exclusiones solo para ISO 9001 con justificación). Admite documento del cliente, modo generar|actualizar y formato casa|cliente.",
    tituloEntregable: "Determinación del Alcance del Sistema de Gestión",
    codigo: "4.3",
    clausula: "4.3 Determinación del alcance del sistema de gestión",
    descripcionEntregable:
      "la Determinación del alcance del sistema de gestión (declaración formal y límites)",
    systemCasa: SYSTEM,
    tarea: (p: Perfil) =>
      `Redacta la determinación del alcance (requisito 4.3) para la organización descrita, alineada a ${normasTexto(
        p
      )}.`,
    render,
    renderDocx,
    datosPlantilla,
    maxTokens: 4000,
  });
}

const seccionLista = (heading: string, lista: string[]): DocSeccion => ({ heading, lista });

function renderDocx(data: Resultado, p: Perfil): DocSpec {
  const secciones: DocSeccion[] = [
    { heading: "Declaración de alcance", parrafo: data.declaracionAlcance },
    seccionLista("Productos y servicios cubiertos", data.productosServicios),
    seccionLista("Límites físicos (sedes / instalaciones)", data.sedes),
    seccionLista("Límites organizacionales (unidades / áreas)", data.unidades),
    seccionLista("Procesos incluidos", data.procesosIncluidos),
  ];
  if (data.exclusiones && data.exclusiones.length) {
    secciones.push({
      heading: "Requisitos no aplicables (solo ISO 9001) y su justificación",
      tabla: {
        headers: ["Requisito", "Justificación de no aplicabilidad"],
        filas: data.exclusiones.map((e) => [e.requisito, e.justificacion]),
      },
    });
  } else {
    secciones.push({ heading: "Requisitos no aplicables", parrafo: "No se declaran exclusiones." });
  }
  return {
    titulo: "Determinación del Alcance del Sistema de Gestión",
    empresa: p.nombre,
    requisito: "4.3 Determinación del alcance del sistema de gestión",
    secciones,
  };
}

function datosPlantilla(data: Resultado, p: Perfil): Record<string, unknown> {
  const items = (arr: string[]) => arr.map((x) => ({ item: x }));
  return {
    empresa: p.nombre,
    codigo: "SIG-F-005",
    declaracion: data.declaracionAlcance,
    productos: items(data.productosServicios),
    sedes: items(data.sedes),
    unidades: items(data.unidades),
    procesos: items(data.procesosIncluidos),
    exclusiones: (data.exclusiones ?? []).map((e) => ({
      requisito: e.requisito,
      justificacion: e.justificacion,
    })),
  };
}
