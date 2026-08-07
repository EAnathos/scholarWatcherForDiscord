import { logger } from './logger.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export async function fetchWithRetry<T>(
  url: string,
  options?: { headers?: Record<string, string>; source?: string },
  attempt = 1,
): Promise<T | null> {
  const source = options?.source ?? 'fetch';
  try {
    const response = await fetch(url, {
      headers: options?.headers,
    });

    if (response.status === 429 && attempt <= MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn({ attempt, delay, source }, 'Rate limited, retrying');
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry<T>(url, options, attempt + 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (attempt <= MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn({ attempt, delay, error, source }, 'Fetch error, retrying');
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry<T>(url, options, attempt + 1);
    }
    logger.error({ error, source }, 'Fetch failed after retries');
    return null;
  }
}
