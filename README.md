# Laboratorio 3 – Resumidor con la API de OpenAI

Aplicación de línea de comandos en TypeScript que resume un texto en 3 puntos principales usando un modelo del servicio del curso. Muestra la respuesta, el motivo de parada y los tokens consumidos, y gestiona timeouts y reintentos.

## Instalación

```bash
npm install
```

Crea un archivo `.env` en la raíz del proyecto:

```env
OPENAI_API_KEY=<tu clave del curso>
OPENAI_BASE_URL=https://ai.commitacademy.io/v1
MODELO=fast
```

## Uso

```bash
npx tsx app.ts "<texto>" | <ruta-a-archivo> [opciones]
```

El argumento puede ser el texto directamente o la ruta de un archivo; si la ruta existe, se lee su contenido.

### Opciones

| Opción | Descripción |
| --- | --- |
| `--json` | Imprime la respuesta completa del modelo en formato JSON (`id`, `model`, `finish_reason`, `usage`, ...). |
| `--max-tokens <n>` | Límite de tokens de la respuesta (por defecto: 256). Debe ser un entero positivo. |
| `--stream` | Muestra la respuesta según llega y mide el tiempo hasta el primer trozo y el total. Sin esta opción, se mide solo el tiempo total. |
| `--timeout <segundos>` | Tiempo máximo de espera de la llamada, en segundos (admite decimales, por ejemplo `0.5`). Si no se indica, se usa el valor por defecto de la librería. |

El modelo se elige con la variable de entorno `MODELO` (por defecto `fast`).

### Ejemplos

```bash
npx tsx app.ts "Javascript es un lenguaje de programación ..."
npx tsx app.ts prompts/01-prompt.txt
npx tsx app.ts prompts/01-prompt.txt --json
npx tsx app.ts prompts/01-prompt.txt --max-tokens 10
npx tsx app.ts prompts/01-prompt.txt --stream
npx tsx app.ts prompts/01-prompt.txt --timeout 0.001
MODELO=chaos npx tsx app.ts prompts/01-prompt.txt
```

## Timeouts y reintentos

El cliente se crea con `maxRetries: 0` para que la librería no reintente por su cuenta; los reintentos los gestiona `withRetries` en `retries.ts`.

- **Se reintentan** (`isTransient`): errores `429`, `5xx`, y timeouts o errores de conexión.
- **No se reintentan:** `400`, `401`, `403`, `404` y cualquier otro error.
- **Espera:** exponencial con *full jitter*, un tiempo aleatorio entre `0` y `min(30 s, 1 s × 2^intento)`.
- **Máximo:** 4 intentos (1 llamada original y 3 reintentos).
- Con `--stream` solo se reintenta la creación del stream; si falla a mitad de la respuesta no se repite.
- Si se agotan los intentos, la aplicación termina con un error de una línea.

## Pruebas de reintentos

`test-retries.ts` prueba `withRetries` con llamadas falsas, sin consumir presupuesto:

```bash
npx tsx test-retries.ts
```

- Una llamada que falla con `503`: se reintenta.
- Una llamada que falla con `400`: no se reintenta.

Para probar con errores reales, el modelo `chaos` falla al azar con errores `429`:

```bash
for i in {1..10}; do echo "=== Ejecución $i ==="; MODELO=chaos npx tsx app.ts prompts/01-prompt.txt; done
```

Para ver el timeout, usa `--timeout 0.001`.

## Estructura

```
app.ts            Aplicación principal (CLI, call_model, read_response)
retries.ts        isTransient y withRetries
test-retries.ts   Pruebas de reintentos con llamadas falsas
prompts/          Textos de ejemplo
imgs/             Capturas de la terminal
docs/             Enunciado y análisis
```
