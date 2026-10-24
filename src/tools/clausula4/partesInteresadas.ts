import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registrarHerramienta } from "../../lib/herramienta.js";
import { normasTexto, type Perfil } from "../../lib/perfil.js";
import { tablaMarkdown } from "../../lib/render.js";
import type { DocSpec } from "../../lib/docx/casa.js";
import { limpiarMarcasTexto } from "../../lib/docx/marcas.js";

export interface Parte {
  parte: string;
  tipo: "interna" | "externa";
  /** Lista de expectativas: una entrada por viñeta del documento. */
  necesidadesExpectativas: string[];
  /** Lista de requisitos obligatorios: una entrada por viñeta. */
  requisitos: string[];
  esRequisitoLegal: boolean;
  influencia: "alta" | "media" | "baja";
  seguimiento: string;
  /**
   * Mecanismo del sistema de gestión que aborda el requisito. Solo lo exigen
   * algunas normas (ISO 37001:2025, 4.2 literal c). Cadena vacía si no aplica.
   */
  abordadoSGAS: string;
}
export interface Resultado {
  partes: Parte[];
}

const SYSTEM = `Eres un consultor auditor líder ISO con experiencia en Perú, experto en el Anexo SL.

Tu tarea: determinar las PARTES INTERESADAS pertinentes al SIG y sus necesidades y expectativas, según el requisito 4.2 "Comprensión de las necesidades y expectativas de las partes interesadas".

Reglas de rigor:
- Identifica partes interesadas INTERNAS (accionistas/dirección, trabajadores, comités —ej. Comité de SST—) y EXTERNAS (clientes/usuarios, proveedores y contratistas, entes reguladores, comunidad/vecinos, competidores cuando aplique, entidades financieras).
- Para cada una: sus necesidades y expectativas concretas, y los REQUISITOS pertinentes que la organización decide adoptar como obligaciones de cumplimiento del SIG.
- Marca si el requisito es de origen LEGAL (esRequisitoLegal). Ancla lo legal al marco PERUANO según las normas objetivo (ej. Sunafil/Ley 29783 para SST; OEFA/MINAM para ambiental; Indecopi para calidad; para antisoborno/SGAS: Ley 30424 y su reglamento D.S. 002-2019-JUS, Contraloría, y la SBS cuando la organización sea del sistema financiero).
- Estima la influencia/poder de la parte sobre el SIG (alta/media/baja).
- Indica cómo se hace el seguimiento y revisión de esa parte (canal o mecanismo).
- "abordadoSGAS": SOLO cuando la norma objetivo lo exija (p. ej. ISO 37001:2025, requisito 4.2 literal c: "cuáles de esos requisitos se abordarán mediante el sistema de gestión antisoborno"). En ese caso indica el MECANISMO CONCRETO del sistema de gestión que aborda ese requisito (p. ej. "Revisión por la dirección", "Canal de denuncias", "Debida diligencia de terceros"), o "No se aborda" si la organización decide no atenderlo. Si la norma objetivo NO lo exige, devuelve cadena vacía "".
- NUNCA rellenes "abordadoSGAS" con un "Sí" genérico: o das el mecanismo, o lo dejas vacío.
- "requisitos" y "necesidadesExpectativas" son ARREGLOS: una entrada por cada punto o viñeta. NO los fusiones en un solo texto separado por punto y coma; si el documento del cliente tiene 6 viñetas, devuelve 6 entradas. Conserva la redacción original de cada viñeta cuando exista.
- Solo partes PERTINENTES al SIG; no listes actores irrelevantes.

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "partes": [
    { "parte": "string", "tipo": "interna"|"externa", "necesidadesExpectativas": ["string"], "requisitos": ["string"], "esRequisitoLegal": true|false, "influencia": "alta"|"media"|"baja", "seguimiento": "string", "abordadoSGAS": "string" }
  ]
}
Sin texto fuera del JSON.`;

/** ¿Alguna parte trae el mecanismo del literal c)? (ISO 37001:2025) */
const exigeAbordado = (data: Resultado) => data.partes.some((p) => p.abordadoSGAS?.trim());

export function render(data: Resultado): string {
  const internas = data.partes.filter(esInterna);
  const externas = data.partes.filter((p) => !esInterna(p));
  const conAbordado = exigeAbordado(data);
  const headers = [
    "Parte interesada",
    "Necesidades y expectativas",
    "Requisitos para el SIG",
    "¿Legal?",
    "Influencia",
    "Seguimiento",
    ...(conAbordado ? ["Abordado mediante el sistema de gestión"] : []),
  ];
  const filas = (ps: Parte[]) =>
    ps.map((p) => [
      p.parte,
      lista(p.necesidadesExpectativas).join("<br>"),
      lista(p.requisitos).join("<br>"),
      p.esRequisitoLegal ? "Sí" : "No",
      p.influencia,
      p.seguimiento,
      ...(conAbordado ? [p.abordadoSGAS ?? ""] : []),
    ]);
  return [
    `Se determinan las partes interesadas pertinentes al sistema de gestión, sus necesidades y expectativas, y cuáles de esos requisitos la organización adopta como obligaciones de cumplimiento. Los requisitos legales alimentan la evaluación del cumplimiento y la planificación (6.1).`,
    ``,
    `## Partes interesadas internas (${internas.length})`,
    tablaMarkdown(headers, filas(internas)),
    ``,
    `## Partes interesadas externas (${externas.length})`,
    tablaMarkdown(headers, filas(externas)),
  ].join("\n");
}

const PRIORIDAD: Record<string, string> = { alta: "3", media: "2", baja: "1" };

/**
 * Normaliza un enumerado que el modelo pudo devolver con marcas de control de
 * cambios o con variantes ("INTERNO", "Interna"). Si el filtro dependiera del
 * valor crudo, una marca como "{{+externa+}}" vaciaría el documento entero.
 */
const enumNorm = (v: unknown) =>
  limpiarMarcasTexto(String(v ?? ""))
    .trim()
    .toLowerCase();

/** Tolera que el modelo devuelva un string donde el esquema pide un arreglo. */
const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter((s) => s.trim()) : String(v ?? "").trim() ? [String(v)] : [];

const esInterna = (x: Parte) => enumNorm(x.tipo).startsWith("intern");
const influenciaDe = (x: Parte) => enumNorm(x.influencia);

/** Estructura para el Word "formato casa". */
export function renderDocx(data: Resultado, p: Perfil): DocSpec {
  const conAbordado = exigeAbordado(data);
  const seccion = (titulo: string, ps: Parte[]) => ({
    heading: `${titulo} (${ps.length})`,
    tabla: {
      headers: [
        "Parte interesada",
        "Necesidades y expectativas",
        "Requisitos para el SIG",
        "¿Legal?",
        "Influencia",
        "Seguimiento",
        ...(conAbordado ? ["Abordado mediante el sistema de gestión"] : []),
      ],
      filas: ps.map((x) => [
        x.parte,
        lista(x.necesidadesExpectativas).join("\n"),
        lista(x.requisitos).join("\n"),
        x.esRequisitoLegal ? "Sí" : "No",
        x.influencia,
        x.seguimiento,
        ...(conAbordado ? [x.abordadoSGAS ?? ""] : []),
      ]),
    },
  });
  return {
    titulo: "Matriz de Partes Interesadas",
    empresa: p.nombre,
    requisito: "4.2 Comprensión de las necesidades y expectativas de las partes interesadas",
    intro:
      "Se determinan las partes interesadas pertinentes al sistema de gestión, sus necesidades y expectativas, y cuáles de esos requisitos la organización adopta como obligaciones de cumplimiento.",
    secciones: [
      seccion("Partes interesadas internas", data.partes.filter(esInterna)),
      seccion("Partes interesadas externas", data.partes.filter((x) => !esInterna(x))),
    ],
  };
}

/**
 * Datos para rellenar la plantilla .docx del cliente (marcadores docxtemplater).
 * Se emite un superconjunto de campos para que cada cliente use los que su
 * formato tenga. Todos salen del modelo: NADA se rellena con valores fijos.
 */
export function datosPlantilla(data: Resultado, p: Perfil): Record<string, unknown> {
  const fila = (x: Parte) => ({
    ambito: esInterna(x) ? "INTERNO" : "EXTERNO",
    parte: x.parte,
    // Arreglos: alimentan el bucle de párrafo dentro de la celda, preservando
    // una viñeta por entrada (el formato del cliente).
    requisitosLista: lista(x.requisitos),
    necesidadesLista: lista(x.necesidadesExpectativas),
    requisitos: lista(x.requisitos).join("\n"),
    necesidades: lista(x.necesidadesExpectativas).join("\n"),
    legal: x.esRequisitoLegal ? "Sí" : "No",
    influencia: x.influencia,
    seguimiento: x.seguimiento,
    aborda: x.abordadoSGAS?.trim() ?? "",
    requisito: x.requisitos,
    tipo: x.esRequisitoLegal ? "Legal" : "Otro",
    prioridad: PRIORIDAD[influenciaDe(x)] ?? "2",
  });
  return {
    empresa: p.nombre,
    // Bucles separados: permiten que la plantilla del cliente conserve el
    // formato condicional por fila (p. ej. internas celeste, externas salmón),
    // que docxtemplater no puede aplicar según los datos.
    internas: data.partes.filter(esInterna).map(fila),
    externas: data.partes.filter((x) => !esInterna(x)).map(fila),
    partes: data.partes.map((x) => ({
      // nombres nuevos, más explícitos
      ambito: esInterna(x) ? "INTERNO" : "EXTERNO",
      parte: x.parte,
      requisitos: x.requisitos,
      necesidades: x.necesidadesExpectativas,
      legal: x.esRequisitoLegal ? "Sí" : "No",
      influencia: x.influencia,
      seguimiento: x.seguimiento,
      // literal c) de ISO 37001:2025 — vacío si la norma no lo exige
      aborda: x.abordadoSGAS?.trim() ?? "",
      // alias retrocompatibles con ejemplos/plantilla-partes-interesadas.docx
      requisito: x.requisitos,
      tipo: x.esRequisitoLegal ? "Legal" : "Otro",
      prioridad: PRIORIDAD[influenciaDe(x)] ?? "2",
    })),
  };
}

export function registrarPartesInteresadas(server: McpServer): void {
  registrarHerramienta<Resultado>(server, {
    nombre: "contexto_partes_interesadas_4_2",
    title: "4.2 · Matriz de partes interesadas",
    descripcion:
      "Genera la Matriz de Partes Interesadas del requisito 4.2 (necesidades, expectativas y requisitos pertinentes al SIG), con marca de requisito legal según el marco peruano. Admite documento del cliente, modo generar|actualizar y formato casa|cliente.",
    tituloEntregable: "Matriz de Partes Interesadas",
    codigo: "4.2",
    clausula: "4.2 Comprensión de las necesidades y expectativas de las partes interesadas",
    descripcionEntregable:
      "la Matriz de partes interesadas (necesidades, expectativas y requisitos pertinentes al SIG)",
    systemCasa: SYSTEM,
    tarea: (p: Perfil) =>
      `Determina las partes interesadas y sus necesidades/expectativas (requisito 4.2) para la organización descrita, alineadas a ${normasTexto(
        p
      )}.`,
    render,
    renderDocx,
    datosPlantilla,
  });
}
