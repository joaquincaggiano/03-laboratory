import "dotenv/config"; // carga la clave y la dirección del servicio desde .env
import OpenAI from "openai";
import { withRetries } from "./retries.js";
import { existsSync, readFileSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { ChatCompletion } from "openai/resources";
import { ChatCompletionMessageParam } from "openai/resources.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: "boolean", default: false },
    "max-tokens": { type: "string" },
    stream: { type: "boolean", default: false },
    timeout: { type: "string" },
  },
});

let timeout: number | undefined;
if (values.timeout) {
  timeout = parseFloat(values.timeout);
  if (isNaN(timeout) || timeout <= 0) {
    console.error("--timeout debe ser un número positivo.");
    process.exit(1);
  }
}

const client = new OpenAI({
  timeout: timeout ? timeout * 1000 : undefined,
  maxRetries: 0,
}); // lee OPENAI_API_KEY y OPENAI_BASE_URL del entorno
const MODELO = process.env.MODELO ?? "fast";

// Límite de tokens de la respuesta
let maxTokens = 256;
if (values["max-tokens"]) {
  maxTokens = parseInt(values["max-tokens"], 10);
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    console.error("--max-tokens debe ser un entero positivo.");
    process.exit(1);
  }
}

// Obtenemos el prompt desde la línea de comandos
let prompt = positionals[0];

// Si no se proporcionó un prompt, mostramos un mensaje de como se utiliza la aplicación
if (!prompt) {
  console.error(
    `Para utilizar la aplicación, debes proporcionar un texto o archivo luego de ejecutar el comando:\n- npx tsx app.ts "<texto>" | <ruta-a-archivo> [--json]\n\nResume un texto en 3 puntos principales.\nOpciones:\n- --json: muestra la respuesta completa del modelo en formato JSON.\n- --max-tokens: límite de tokens de la respuesta (por defecto: 256).\n- --stream: muestra la respuesta del modelo de forma streaming.\n- --timeout: tiempo de espera en segundos (por defecto: 30).\n\nEjemplos:\n- npx tsx app.ts "Javascript es un lenguaje de programación ..."\n- npx tsx app.ts docs/texto.txt\n- npx tsx app.ts docs/texto.txt --json\n- npx tsx app.ts docs/texto.txt --stream\n- npx tsx app.ts docs/texto.txt --timeout 0.5`,
  );
  process.exit(1);
}

// Si el prompt es un archivo, leemos su contenido, sino se trata como texto y se usa tal cual
if (existsSync(prompt) && statSync(prompt).isFile()) {
  prompt = readFileSync(prompt, "utf-8");
}

const readResponse = (res: ChatCompletion) => {
  const choice = res.choices[0];
  const text = choice.message.content;

  if (!text?.trim()) {
    throw new Error("La respuesta está vacía");
  }

  if (choice.message.refusal) {
    throw new Error(`El modelo se negó: ${choice.message.refusal}`);
  }
  if (choice.finish_reason === "content_filter") {
    throw new Error("Respuesta bloqueada por el filtro de contenido");
  }

  return {
    text,
    finishReason: choice.finish_reason,
    tokens: res.usage,
    model: res.model,
    id: res.id,
  };
};

const callModel = async ({
  client,
  system,
  messages,
  maxTokens,
  stop,
  stream = false,
}: {
  client: OpenAI;
  system: string;
  messages: ChatCompletionMessageParam[];
  maxTokens: number;
  stop?: string | string[];
  stream?: boolean;
}): Promise<ChatCompletion> => {
  const params = {
    model: MODELO,
    messages: [{ role: "system" as const, content: system }, ...messages],
    max_completion_tokens: maxTokens,
    stop,
  };

  const start = performance.now();

  if (stream) {
    const chunks = await withRetries(() =>
      client.chat.completions.create({
        ...params,
        stream: true,
        stream_options: { include_usage: true },
      }),
    );

    let text = "";
    let finishReason: ChatCompletion.Choice["finish_reason"] = "stop";
    let id = "";
    let model = MODELO;
    let created = 0;
    let usage: ChatCompletion["usage"];
    let firstChunkMs: number | undefined;

    for await (const chunk of chunks) {
      id = chunk.id;
      model = chunk.model;
      created = chunk.created;
      if (chunk.usage) usage = chunk.usage; // llega en el último chunk y choices llega vacío

      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta.content;
      if (delta) {
        firstChunkMs ??= performance.now() - start;
        text += delta;
        process.stdout.write(delta); // mostramos el texto según llega
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
    process.stdout.write("\n");

    const totalMs = performance.now() - start;
    console.log(
      `\nTiempo hasta el primer trozo: ${firstChunkMs?.toFixed(0)} ms | Tiempo total: ${totalMs.toFixed(0)} ms`,
    );

    return {
      id,
      object: "chat.completion",
      created,
      model,
      choices: [
        {
          index: 0,
          finish_reason: finishReason,
          logprobs: null,
          message: { role: "assistant", content: text, refusal: null },
        },
      ],
      usage,
    };
  }

  const response = await withRetries(() =>
    client.chat.completions.create(params),
  );
  console.log(
    `\nTiempo total (sin streaming): ${(performance.now() - start).toFixed(0)} ms`,
  );
  return response;
};

let response: ChatCompletion;
try {
  response = await callModel({
    client,
    system: "Resume el texto del usuario en 3 puntos principales.",
    messages: [{ role: "user", content: prompt }],
    maxTokens,
    stream: values.stream,
  });
} catch (error) {
  // Error con --timeout 0.001
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

if (values.json) {
  console.log(JSON.stringify(response, null, 2));
  process.exit(0);
}

const r = readResponse(response);
// Con --stream el texto ya se mostró mientras llegaba
if (!values.stream) console.log(`\nRespuesta: ${r.text}\n`);

// Por qué terminó: "stop" = de forma natural; "length" = se cortó por el límite.
const finishReason = r.finishReason;
switch (finishReason) {
  case "length":
    console.warn(
      `${finishReason}: La respuesta supero el límite de tokens permitidos.`,
    );
    break;
  case "stop":
    console.log(
      `${finishReason}: La respuesta se ha terminado de forma natural.`,
    );
    break;
  default:
    console.log(
      `${finishReason}: La respuesta se ha terminado de forma inesperada.`,
    );
    break;
}

console.log(`Tokens de entrada: ${r.tokens?.prompt_tokens}`);
console.log(`Tokens de salida: ${r.tokens?.completion_tokens}`);
console.log(`Tokens totales: ${r.tokens?.total_tokens}`);
