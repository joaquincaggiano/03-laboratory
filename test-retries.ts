// Prueba de reintentos con llamadas falsas (no consume presupuesto).
// Ejecutar: npx tsx test-retries.ts
import { APIError } from "openai";
import { withRetries } from "./retries.js";

const fakeCallError = async (status: number) => {
  throw APIError.generate(status, undefined, "fake error", new Headers());
};

const run = async (status: number) => {
  console.log(`\n--- Llamada falsa con error ${status} ---`);
  try {
    await withRetries(() => fakeCallError(status));
  } catch (error) {
    console.error(
      `Error final: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

await run(503); // transitorio: se reintenta
await run(400); // no transitorio: no se reintenta
