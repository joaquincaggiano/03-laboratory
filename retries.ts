import { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";

export const isTransient = (error: unknown) => {
  if (
    error instanceof APIConnectionError ||
    error instanceof APIConnectionTimeoutError
  ) {
    return true;
  }
  if (error instanceof APIError) {
    return error.status === 429 || error.status >= 500;
  }
  return false;
};

export const withRetries = async <T>(fn: () => Promise<T>): Promise<T> => {
  const maxRetries = 3; // 1 llamada original + 3 reintentos = 4 intentos

  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (error) {
      // No se reintenta si el error no es transitorio o si era el último intento
      if (!isTransient(error) || i >= maxRetries) throw error;

      // Full jitter: espera aleatoria entre 0 y min(30 s, 1 s × 2^i)
      const maxWaitSeconds = Math.min(30, 2 ** i);
      const waitMs = Math.random() * maxWaitSeconds * 1000;
      console.warn(
        `Intento ${i + 1} fallido, reintentando en ${(waitMs / 1000).toFixed(2)} s...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
};
