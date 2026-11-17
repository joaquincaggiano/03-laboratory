import "dotenv/config"; // carga la clave y la dirección del servicio desde .env
import OpenAI from "openai";
import { existsSync, readFileSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { ChatCompletion } from "openai/resources";

const client = new OpenAI(); // lee OPENAI_API_KEY y OPENAI_BASE_URL del entorno
const MODELO = process.env.MODELO ?? "fast";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: "boolean", default: false },
    // "max-tokens": { type: "string" },
    // timeout: { type: "string" },
    // stream: { type: "boolean", default: false },
  },
});

// Obtenemos el prompt desde la línea de comandos
let prompt = positionals[0];

// Si no se proporcionó un prompt, mostramos un mensaje de como se utiliza la aplicación
if (!prompt) {
  console.error(
    `Para utilizar la aplicación, debes proporcionar un texto o archivo luego de ejecutar el comando:\n- npx tsx app.ts "<texto>" | <ruta-a-archivo> [--json]\n\nResume un texto en 3 puntos principales.\nOpciones:\n- --json: muestra la respuesta completa del modelo en formato JSON.\n\nEjemplos:\n- npx tsx app.ts "Javascript es un lenguaje de programación ..."\n- npx tsx app.ts docs/texto.txt\n- npx tsx app.ts docs/texto.txt --json`,
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

const response = await client.chat.completions.create({
  model: MODELO,
  messages: [
    {
      role: "system",
      content: "Resume el texto del usuario en 3 puntos principales.",
    },
    {
      role: "user",
      content: prompt,
    },
  ],
  max_completion_tokens: 256, // límite de la respuesta, en tokens
});

if (values.json) {
  console.log(JSON.stringify(response, null, 2));
  process.exit(0);
}

const r = readResponse(response);
console.log(`\nRespuesta: ${r.text}\n`);

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
