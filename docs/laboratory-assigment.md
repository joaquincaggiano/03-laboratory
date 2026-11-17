# Enunciado

## Actividades a realizar

### 0. Preparación

Crear una carpeta `laboratorio-3` e instalar la librería oficial de OpenAI y la que carga el `.env`:

- **Python:** `python3 -m venv .venv`, activar el entorno y `pip install openai python-dotenv`.
- **TypeScript:** `npm init -y`, `npm pkg set type=module`, `npm install openai dotenv` y `npm install --save-dev tsx`.

Crear el archivo `.env` con tu clave del curso:

```env
OPENAI_API_KEY=<tu clave del curso>
OPENAI_BASE_URL=https://ai.commitacademy.io/v1
MODELO=fast
```

Escribir un **resumidor mínimo** que reciba un texto (como argumento o desde un archivo), lo resuma en 3 puntos con un `system prompt` fijo y muestre el resultado y los tokens consumidos.

### 1. Leer la respuesta

- Añadir una opción `--json` que imprima la respuesta completa e identificar en ella `id`, `model`, `finish_reason` y `usage`.
- Escribir `read_response`, que devuelva texto, motivo de parada, tokens, modelo e id, y lance un error si:
  - la respuesta está vacía,
  - el modelo se niega (`refusal`),
  - se bloquea (`content_filter`).
- Avisar al usuario cuando la respuesta se corte por el tope (`finish_reason: "length"`).

### 2. Instrucciones y parámetros

- Escribir `call_model(client, system, messages, max_tokens, stop)`, con las instrucciones, los mensajes y los parámetros separados.
- Añadir una opción `--max-tokens`.

### 3. Streaming

- Escribir `call_model_streaming` (o añadir un parámetro a `call_model`), que muestre el texto según llega y devuelva al final lo mismo que `call_model`. Para recibir el consumo, añadir `stream_options: { include_usage: true }`.
- Añadir una opción `--stream` y medir el tiempo hasta el primer trozo y el total, con y sin streaming.

### 4. Timeouts y reintentos

- Crear el cliente con un timeout configurable (`--timeout`) y sin los reintentos de la librería (`max_retries=0` en Python, `maxRetries: 0` en TypeScript).
- Escribir `is_transient`:
  - **Se reintentan:** `429`, `5xx` y los timeouts o errores de conexión.
  - **No se reintentan:** `400`, `401`, `403`, `404` ni el presupuesto agotado.
- Escribir `with_retries`, con espera exponencial aleatoria (*full jitter*): esperar un tiempo aleatorio entre `0` y `min(30 s, 1 s × 2^intento)`, con un máximo de **4 intentos**.
- Comprobarlo:
  - Con una llamada falsa que falla con un `503`: se reintenta.
  - Con una que falla con un `400`: no se reintenta.
  - Con `--timeout 0.001`: se agota y termina con un error de una línea.
- Probarlo con errores reales: el modelo `chaos` del servicio del curso es gratis y falla al azar con errores `429`. Ejecutar **10 veces** el resumidor con `MODELO=chaos`.

---

## 📦 Entregable

El estudiante deberá enviar un archivo `.zip` que contenga:

### 💻 Código fuente

El código fuente y un `README` breve con cómo ejecutarlo y sus opciones.

### 📸 Capturas de la terminal

1. La respuesta con `--json`.
2. El corte con `--max-tokens 10` y la lista cortada por `stop`.
3. Una ejecución con `--stream` y sus tiempos.
4. Los reintentos con la llamada falsa (`503`) y el `400` sin reintentar.
5. El error con `--timeout 0.001`.
6. Una ejecución con `chaos` en la que se vea un reintento.

### 📄 Análisis

Un `analisis.md` con la explicación de lo aprendido durante los ejercicios y los retos encontrados.

---

## 🔒 Buenas prácticas

- No incluir el `.env` ni las carpetas de dependencias (`.venv`, `node_modules`) en el `.zip`.
- No mostrar la clave en las capturas.
- Probar los fallos con llamadas falsas o con `chaos`: las llamadas a `fast` y `smart` consumen presupuesto.
