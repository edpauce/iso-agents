import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PerfilSchema,
  perfilShape,
  perfilResumen,
  normasTexto,
  type Perfil,
} from "./perfil.js";
import {
  OpcionesSchema,
  opcionesShape,
  resolverDocumento,
  bloqueDocumento,
  INSTRUCCION_ACTUALIZAR,
} from "./opciones.js";
import { generarJson, generarTexto } from "./anthropic.js";
import { cargarTextoNormativo, tituloOficial } from "./normas.js";
import { entregable } from "./render.js";
import { construirDocx, type DocSpec } from "./docx/casa.js";
import { mdADocx } from "./docx/markdown.js";
import { rellenarPlantilla } from "./docx/plantilla.js";
import { escribirDocx, slug } from "./docx/salida.js";
import { limpiarMarcasTexto } from "./docx/marcas.js";
import { verificarFidelidad, formatearReporte } from "./fidelidad.js";
import { extraerTexto } from "./extract.js";

/**
 * Especificación de una herramienta de entregable. Cada documento del SIG
 * (cláusula por cláusula) se declara con este spec y se registra con
 * `registrarHerramienta`, que aplica de forma uniforme el grounding, el modo
 * (generar/actualizar) y el formato (casa/cliente).
 */
export interface HerramientaSpec<T> {
  nombre: string;
  title: string;
  descripcion: string;
  tituloEntregable: string;
  /** Código del requisito para cargar su referencia normativa (ej. "4.2"). */
  codigo: string;
  clausula: string;
  /** Qué es el documento (se usa en el modo formato-cliente, sin esquema). */
  descripcionEntregable: string;
  /** System prompt de la metodología casa (pide JSON estructurado). */
  systemCasa: string;
  /** Línea de tarea para el user prompt. */
  tarea: (p: Perfil) => string;
  /** Render del cuerpo Markdown a partir del JSON estructurado. */
  render: (data: T, p: Perfil) => string;
  /** Estructura para el Word "formato casa" (export .docx). Opcional por ahora. */
  renderDocx?: (data: T, p: Perfil) => DocSpec;
  /** Datos para rellenar una plantilla .docx del cliente (docxtemplater). Opcional. */
  datosPlantilla?: (data: T, p: Perfil) => Record<string, unknown>;
  maxTokens?: number;
}

function contenido(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], ...(isError ? { isError: true } : {}) };
}

function mensajeError(e: unknown): string {
  const detalle = e instanceof Error ? e.message : String(e);
  return `⚠️ ${detalle}`;
}

export function registrarHerramienta<T>(server: McpServer, spec: HerramientaSpec<T>): void {
  server.registerTool(
    spec.nombre,
    {
      title: spec.title,
      description: spec.descripcion,
      inputSchema: { ...perfilShape, ...opcionesShape },
    },
    async (args) => {
      let perfil: Perfil;
      try {
        perfil = PerfilSchema.parse(args);
      } catch (e) {
        return contenido(mensajeError(e), true);
      }
      const opciones = OpcionesSchema.parse(args);
      const modo = opciones.modo ?? "generar";
      const formato = opciones.formato ?? "casa";

      let doc: string | null;
      try {
        doc = await resolverDocumento(opciones);
      } catch (e) {
        return contenido(mensajeError(e), true);
      }

      if ((modo === "actualizar" || formato === "cliente") && !doc) {
        return contenido(
          `⚠️ El modo '${modo}' con formato '${formato}' requiere un documento del cliente. Pásalo en 'documentoCliente' (texto) o 'documentoClientePath' (ruta .docx/.txt/.md).`,
          true
        );
      }

      const cabecera = [
        spec.tarea(perfil),
        "",
        perfilResumen(perfil),
        `\nNormas objetivo: ${normasTexto(perfil)}.`,
      ].join("\n");

      // Referencia normativa del requisito (guía común + textos oficiales
      // incorporados). Ciñe la salida a lo que la norma pide y evita el "de más".
      const normasObjetivo = perfil.normas && perfil.normas.length ? perfil.normas : ["9001"];
      const normativa = await cargarTextoNormativo(spec.codigo, normasObjetivo);
      // Título oficial del requisito según la norma objetivo (varía entre normas);
      // si no hay texto oficial cargado, se usa la etiqueta genérica del spec.
      const requisitoTexto = (await tituloOficial(spec.codigo, normasObjetivo)) ?? spec.clausula;
      const refNormativa = normativa
        ? `\n\nREFERENCIA NORMATIVA — lo que EXIGE el requisito ${spec.codigo} (cíñete a esto; no agregues elementos, secciones ni campos que la norma no pide):\n"""\n${normativa}\n"""`
        : "";
      const noDemas =
        "\n\nAlcance del entregable: produce exactamente lo que el requisito exige, ni más ni menos. No inventes documentos, secciones ni datos que la norma no solicita. Esta regla NO autoriza a omitir lo que la norma sí exige, ni a recortar, resumir o fusionar el contenido existente del cliente.";

      const quiereDocx = Boolean(opciones.exportarDocx);
      const quierePlantilla = Boolean(opciones.plantillaPath?.trim());
      // Datos estructurados sólo cuando el formato es casa, o cuando hay que
      // rellenar la plantilla .docx del cliente (que parte del JSON).
      // OJO: `exportarDocx` NO debe forzar esta rama — el modo formato-cliente
      // produce su propio Word convirtiendo el Markdown (mdADocx).
      const usarEstructurado = formato === "casa" || quierePlantilla;

      // Al rellenar la plantilla del cliente en modo actualizar, el modelo marca
      // lo nuevo/modificado dentro de los valores; el .docx lo colorea (verde /
      // rojo tachado) conservando el formato del cliente.
      const instruccionMarcas =
        quierePlantilla && modo === "actualizar"
          ? `\n\nCONTROL DE CAMBIOS: dentro de los valores de TEXTO LIBRE del JSON, envuelve en {{+ ... +}} el contenido NUEVO o MODIFICADO respecto del documento del cliente, y en {{- ... -}} lo que deba eliminarse. No marques lo que se conserva igual. Las marcas van dentro del propio valor (ej. "Canales de denuncia {{+y protección al denunciante+}}").
NUNCA marques los campos de CLASIFICACIÓN ni los booleanos o enumerados (p. ej. "tipo", "influencia", "esRequisitoLegal"): esos valores deben ir limpios y exactos, o el documento se genera vacío.`
          : "";

      try {
        if (usarEstructurado) {
          const system =
            spec.systemCasa +
            refNormativa +
            noDemas +
            (modo === "actualizar" ? INSTRUCCION_ACTUALIZAR : "") +
            instruccionMarcas;
          const user = cabecera + (doc ? bloqueDocumento(doc, modo) : "");
          const data = await generarJson<T>({ system, user, maxTokens: spec.maxTokens });
          // Las marcas viven para el .docx; el Markdown se entrega limpio.
          const cuerpo = limpiarMarcasTexto(spec.render(data, perfil));
          const md = entregable({
            titulo: spec.tituloEntregable,
            clausula: requisitoTexto,
            empresa: perfil.nombre,
            cuerpo,
            datos: data,
          });

          const notas: string[] = [];
          const base = `${spec.codigo}-${slug(spec.tituloEntregable)}-${Date.now()}`;

          if (quierePlantilla) {
            if (!spec.datosPlantilla) {
              notas.push("⚠️ Esta herramienta aún no soporta rellenar plantilla del cliente.");
            } else {
              try {
                const buf = await rellenarPlantilla(opciones.plantillaPath!, spec.datosPlantilla(data, perfil));
                const ruta = await escribirDocx(base, buf, opciones.salidaPath);
                notas.push(`📄 Plantilla del cliente rellenada — identidad visual exacta:\n   ${ruta}`);
              } catch (e) {
                notas.push(`⚠️ Plantilla: ${mensajeError(e)}`);
              }
            }
          } else if (quiereDocx) {
            if (!spec.renderDocx) {
              notas.push("⚠️ Esta herramienta aún no soporta export a Word (formato casa).");
            } else {
              try {
                const docSpec = { ...spec.renderDocx(data, perfil), requisito: requisitoTexto };
                const buf = await construirDocx(docSpec);
                const ruta = await escribirDocx(base, buf, opciones.salidaPath);
                notas.push(`📄 Word (formato casa) generado:\n   ${ruta}`);
              } catch (e) {
                notas.push(`⚠️ Word: ${mensajeError(e)}`);
              }
            }
          }

          // Guarda de fidelidad: solo en modo actualizar existe la promesa de
          // conservación del contenido del cliente; ahí se mide, siempre.
          if (doc && modo === "actualizar") {
            // El texto estático de la plantilla (título, código) vive en el
            // .docx por construcción: cuenta como conservado, no como adición.
            let contextoSalida = "";
            if (quierePlantilla) {
              try {
                contextoSalida = await extraerTexto(opciones.plantillaPath!);
              } catch {
                // Sin plantilla legible no hay contexto extra; la guarda sigue.
              }
            }
            notas.push(formatearReporte(verificarFidelidad(doc, cuerpo, { contextoSalida })));
          }

          const salida = notas.length ? `${md}\n\n---\n${notas.join("\n")}` : md;
          return contenido(salida);
        }

        // formato === "cliente" SIN plantilla: salida libre que replica el
        // formato del documento del cliente, con nota de brechas frente a la norma.
        const system =
          `Eres un consultor auditor líder ISO en Perú. Vas a producir: ${spec.descripcionEntregable} (requisito ${requisitoTexto}).
El usuario adjunta un documento del cliente. Analiza su formato (secciones, columnas de las tablas, escala/método de valoración, encabezados, estilo) y REPLICA ese mismo formato y metodología en tu salida — NO impongas una plantilla propia. Devuelve el documento final en Markdown, listo para pegar en Word, sin JSON ni explicaciones fuera del documento.` +
          refNormativa +
          noDemas;
        // El entregable debe salir con las brechas YA RESUELTAS dentro del propio
        // documento y con control de cambios en color (como lo haría el consultor),
        // no con una lista de brechas al final para que alguien las levante a mano.
        const controlCambios = `
CONTROL DE CAMBIOS (obligatorio). Marca en el documento todo lo que agregues o modifiques respecto del documento del cliente:
- Contenido NUEVO o MODIFICADO: envuélvelo en {{+ ... +}}
- Contenido que debe ELIMINARSE: envuélvelo en {{- ... -}}
No marques el contenido del cliente que se conserva sin cambios. Las marcas pueden ir dentro de celdas de tabla, encabezados de columna, viñetas o párrafos.`;

        const levantarBrechas = `
LEVANTA LAS BRECHAS DENTRO DEL DOCUMENTO. Si el formato del cliente no cubre algo que el requisito ${spec.codigo} exige, AGRÉGALO al documento (una columna, un campo, una fila o una sección) y COMPLÉTALO con contenido pertinente. No te limites a señalar la brecha: resuélvela. Conserva las columnas y la metodología del cliente; solo añade lo indispensable para cumplir el requisito.`;

        const cierre = `
Cierra el documento con estas dos secciones:

## Cambios realizados
Una viñeta por cambio, indicando qué literal o apartado del requisito ${spec.codigo} lo motiva.

## Pendientes de definición con el cliente
Solo aquello que no puedas resolver sin información que el cliente debe proveer. Si no hay nada pendiente, escribe "Ninguno".`;

        const instruccionCierre =
          (modo === "actualizar"
            ? `Entrega el documento ACTUALIZADO y COMPLETO en el formato del cliente. Conserva lo correcto, corrige lo obsoleto frente a la versión vigente de la norma y completa lo que falte.`
            : `Entrega el documento COMPLETO replicando el formato y la metodología del documento del cliente (sus columnas, escala, encabezados y códigos).`) +
          levantarBrechas +
          controlCambios +
          cierre;
        const user = cabecera + bloqueDocumento(doc!, modo) + "\n\n" + instruccionCierre;
        const { texto, truncado } = await generarTexto({ system, user, maxTokens: spec.maxTokens });
        if (truncado) {
          return contenido(
            `⚠️ ENTREGABLE INCOMPLETO: la generación se cortó al alcanzar el límite de tokens. NO uses este documento — le faltan filas o secciones. Sube 'maxTokens' en el spec de la herramienta.\n\n---\n\n${texto}`,
            true
          );
        }

        // Guarda de fidelidad (misma regla que la rama estructurada).
        const fidelidad =
          doc && modo === "actualizar"
            ? `\n\n---\n${formatearReporte(verificarFidelidad(doc, texto))}`
            : "";

        // El modo formato-cliente devuelve Markdown libre (no hay esquema del que
        // partir), así que el Word se produce convirtiendo ese Markdown.
        if (quiereDocx) {
          try {
            const buf = await mdADocx(texto, {
              titulo: spec.tituloEntregable,
              empresa: perfil.nombre,
              requisito: requisitoTexto,
            });
            const ruta = await escribirDocx(
              `${spec.codigo}-${slug(spec.tituloEntregable)}-cliente-${Date.now()}`,
              buf,
              opciones.salidaPath
            );
            return contenido(
              `${texto}\n\n---\n📄 Word (formato del cliente) generado:\n   ${ruta}${fidelidad}`
            );
          } catch (e) {
            return contenido(`${texto}\n\n---\n⚠️ Word: ${mensajeError(e)}${fidelidad}`);
          }
        }
        return contenido(`${texto}${fidelidad}`);
      } catch (e) {
        return contenido(mensajeError(e), true);
      }
    }
  );
}
