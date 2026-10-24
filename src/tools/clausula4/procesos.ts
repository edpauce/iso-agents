import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registrarHerramienta } from "../../lib/herramienta.js";
import { normasTexto, type Perfil } from "../../lib/perfil.js";
import { tablaMarkdown } from "../../lib/render.js";
import type { DocSpec } from "../../lib/docx/casa.js";

type TipoProceso = "estratégico" | "operativo" | "apoyo";
const ORDEN: TipoProceso[] = ["estratégico", "operativo", "apoyo"];

interface Proceso {
  nombre: string;
  tipo: TipoProceso;
  proveedores: string;
  entradas: string;
  salidas: string;
  clientes: string;
  indicadores: string;
  responsable: string;
}
interface Resultado {
  procesos: Proceso[];
}

const SYSTEM = `Eres un consultor auditor líder ISO con experiencia en Perú, experto en el Anexo SL y en el enfoque a procesos.

Tu tarea: determinar el MAPA DE PROCESOS y sus interacciones, según el requisito 4.4 "Sistema de gestión y sus procesos".

Reglas de rigor:
- Clasifica los procesos en: estratégicos (dirección, planificación, mejora), operativos (los de la cadena de valor que realizan el producto/servicio) y de apoyo (RRHH, compras, mantenimiento, TI).
- Para cada proceso usa el enfoque SIPOC: proveedores, entradas, salidas y clientes (internos o externos) — así queda explícita la INTERACCIÓN y secuencia entre procesos (la salida de uno es la entrada de otro).
- Asigna al menos un indicador de desempeño y un responsable por proceso.
- Parte de los procesos declarados en el perfil de la empresa; complétalos con los que falten para un SIG coherente, sin inventar procesos ajenos al giro.
- No dupliques ni infles: incluye los procesos pertinentes, ni más ni menos.

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "procesos": [
    { "nombre": "string", "tipo": "estratégico"|"operativo"|"apoyo", "proveedores": "string", "entradas": "string", "salidas": "string", "clientes": "string", "indicadores": "string", "responsable": "string" }
  ]
}
Sin texto fuera del JSON.`;

const ETIQUETA: Record<TipoProceso, string> = {
  estratégico: "Procesos estratégicos",
  operativo: "Procesos operativos (cadena de valor)",
  apoyo: "Procesos de apoyo",
};

function render(data: Resultado): string {
  const headers = [
    "Proceso",
    "Proveedores",
    "Entradas",
    "Salidas",
    "Clientes",
    "Indicadores",
    "Responsable",
  ];
  const secciones = ORDEN.map((tipo) => {
    const ps = data.procesos.filter((p) => p.tipo === tipo);
    if (!ps.length) return "";
    const filas = ps.map((p) => [
      p.nombre,
      p.proveedores,
      p.entradas,
      p.salidas,
      p.clientes,
      p.indicadores,
      p.responsable,
    ]);
    return [`### ${ETIQUETA[tipo]} (${ps.length})`, tablaMarkdown(headers, filas)].join("\n");
  })
    .filter(Boolean)
    .join("\n\n");

  return [
    `Se determinan los procesos necesarios para el sistema de gestión y sus interacciones (enfoque a procesos). La secuencia e interacción se hace explícita mediante el esquema SIPOC: la salida de un proceso es la entrada de otro. Cada proceso cuenta con indicadores de desempeño y un responsable.`,
    ``,
    secciones,
  ].join("\n");
}

export function registrarProcesos(server: McpServer): void {
  registrarHerramienta<Resultado>(server, {
    nombre: "contexto_mapa_procesos_4_4",
    title: "4.4 · Mapa de procesos y sus interacciones",
    descripcion:
      "Genera el Mapa de Procesos del requisito 4.4 (procesos estratégicos/operativos/apoyo con enfoque SIPOC: proveedores, entradas, salidas, clientes, indicadores y responsable). Admite documento del cliente, modo generar|actualizar y formato casa|cliente.",
    tituloEntregable: "Mapa de Procesos y sus Interacciones",
    codigo: "4.4",
    clausula: "4.4 Sistema de gestión y sus procesos",
    descripcionEntregable:
      "el Mapa de procesos y sus interacciones (procesos estratégicos, operativos y de apoyo, enfoque SIPOC)",
    systemCasa: SYSTEM,
    tarea: (p: Perfil) =>
      `Determina el mapa de procesos y sus interacciones (requisito 4.4) para la organización descrita, alineado a ${normasTexto(
        p
      )}.`,
    render,
    renderDocx,
    datosPlantilla,
  });
}

const HEADERS_DOCX = [
  "Proceso",
  "Proveedores",
  "Entradas",
  "Salidas",
  "Clientes",
  "Indicadores",
  "Responsable",
];

function renderDocx(data: Resultado, p: Perfil): DocSpec {
  const secciones = ORDEN.map((tipo) => {
    const ps = data.procesos.filter((x) => x.tipo === tipo);
    if (!ps.length) return null;
    return {
      heading: ETIQUETA[tipo],
      tabla: {
        headers: HEADERS_DOCX,
        filas: ps.map((x) => [
          x.nombre,
          x.proveedores,
          x.entradas,
          x.salidas,
          x.clientes,
          x.indicadores,
          x.responsable,
        ]),
      },
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);
  return {
    titulo: "Mapa de Procesos y sus Interacciones",
    empresa: p.nombre,
    requisito: "4.4 Sistema de gestión y sus procesos",
    intro:
      "Se determinan los procesos necesarios para el sistema de gestión y sus interacciones (enfoque a procesos, esquema SIPOC).",
    secciones,
  };
}

function datosPlantilla(data: Resultado, p: Perfil): Record<string, unknown> {
  return {
    empresa: p.nombre,
    codigo: "SIG-F-004",
    procesos: data.procesos.map((x) => ({
      nombre: x.nombre,
      tipo: x.tipo,
      proveedores: x.proveedores,
      entradas: x.entradas,
      salidas: x.salidas,
      clientes: x.clientes,
      indicadores: x.indicadores,
      responsable: x.responsable,
    })),
  };
}
