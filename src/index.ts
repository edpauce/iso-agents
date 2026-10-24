#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registrarCuestiones } from "./tools/clausula4/cuestiones.js";
import { registrarFoda } from "./tools/clausula4/foda.js";
import { registrarPestel } from "./tools/clausula4/pestel.js";
import { registrarPartesInteresadas } from "./tools/clausula4/partesInteresadas.js";
import { registrarAlcance } from "./tools/clausula4/alcance.js";
import { registrarProcesos } from "./tools/clausula4/procesos.js";

/**
 * EHSQ Consulting OS — servidor MCP de herramientas para construir un SIG
 * (Sistema Integrado de Gestión) cláusula por cláusula, sobre la estructura de
 * alto nivel del Anexo SL (requisitos 4–10) común a ISO 9001/14001/45001.
 *
 * Cláusula 4 — Contexto de la organización (completa):
 *   4.1  · contexto_cuestiones_4_1        — Matriz de cuestiones internas y externas
 *        · contexto_foda_4_1              — Análisis FODA (+ FODA cruzado / TOWS)
 *        · contexto_pestel_4_1            — Análisis PESTEL del entorno
 *   4.2  · contexto_partes_interesadas_4_2 — Matriz de partes interesadas
 *   4.3  · contexto_alcance_4_3           — Determinación del alcance del SIG
 *   4.4  · contexto_mapa_procesos_4_4     — Mapa de procesos y sus interacciones
 *
 * Cada herramienta aplica grounding (documento del cliente), modo
 * generar/actualizar, formato casa/cliente y referencia normativa (normas/).
 */
const server = new McpServer({
  name: "ehsq-consulting-os",
  version: "0.1.0",
});

registrarCuestiones(server);
registrarFoda(server);
registrarPestel(server);
registrarPartesInteresadas(server);
registrarAlcance(server);
registrarProcesos(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout está reservado para el protocolo MCP; el log va a stderr.
  console.error("[ehsq-consulting-os] MCP server activo (stdio) · Cláusula 4 completa (4.1–4.4)");
}

main().catch((err) => {
  console.error("[ehsq-consulting-os] fallo al iniciar:", err);
  process.exit(1);
});
