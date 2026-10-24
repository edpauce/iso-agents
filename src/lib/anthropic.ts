import Anthropic from "@anthropic-ai/sdk";

/**
 * Infraestructura compartida para llamar a la API de Claude desde las
 * herramientas del servidor MCP. La API key vive SOLO en el entorno del
 * servidor (nunca se expone al cliente MCP).
 *
 * Patrón heredado de NORMA: el modelo aporta el juicio experto (structured
 * JSON); la aritmética y las reglas fijas de cada norma se resuelven en código.
 */
export const MODELO_DEFAULT = "claude-sonnet-5";
export const MODEL = process.env.ANTHROPIC_MODEL || MODELO_DEFAULT;

let _client: Anthropic | null = null;

/** Cliente Anthropic perezoso; falla claro si falta la key. */
export function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta ANTHROPIC_API_KEY en el entorno del servidor MCP. Configúrala antes de usar las herramientas de generación."
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Quita fences de markdown (```json ... ```) si envuelven TODO el payload.
 * Nunca corta sobre JSON que contenga ``` dentro de un string.
 */
export function extraerJson(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
    if (fence) return fence[1].trim();
  }
  return t;
}

function textoDeRespuesta(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * ¿El modelo cortó la salida por alcanzar max_tokens? Detectarlo es crítico:
 * un entregable de compliance truncado a la mitad PARECE completo, y una matriz
 * a la que le faltan filas es un hallazgo de auditoría, no un detalle.
 */
function truncadoPorLimite(message: Anthropic.Message): boolean {
  return message.stop_reason === "max_tokens";
}

/** Tope alto por defecto: estos entregables son matrices largas. */
const MAX_TOKENS_DEFAULT = 16000;

/**
 * Llama a Claude y devuelve JSON parseado y tipado. El `system` fija el rol de
 * consultor experto; el `user` lleva el perfil + la tarea concreta.
 */
export async function generarJson<T>(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T> {
  const { system, user, maxTokens = MAX_TOKENS_DEFAULT } = args;
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  if (truncadoPorLimite(message)) {
    throw new Error(
      `La respuesta se truncó al alcanzar el límite de ${maxTokens} tokens. El entregable estaría incompleto. Sube 'maxTokens' en el spec de la herramienta o reduce el alcance.`
    );
  }
  const raw = textoDeRespuesta(message);
  try {
    return JSON.parse(extraerJson(raw)) as T;
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    throw new Error(
      `La respuesta del modelo no fue JSON válido (${detalle}). Primeros 300 chars: ${raw.slice(0, 300)}`
    );
  }
}

/**
 * Llama a Claude y devuelve texto (Markdown) directo. Se usa en el modo
 * "formato cliente": el modelo replica el formato del documento del cliente,
 * por lo que no forzamos un esquema JSON propio.
 */
export async function generarTexto(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ texto: string; truncado: boolean }> {
  const { system, user, maxTokens = MAX_TOKENS_DEFAULT } = args;
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return { texto: textoDeRespuesta(message).trim(), truncado: truncadoPorLimite(message) };
}
