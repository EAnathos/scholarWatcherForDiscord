import { createLogger } from './logger.js';

const logger = createLogger('http');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

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

    if (!response.ok) {
      if (RETRYABLE_STATUSES.has(response.status) && attempt <= MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn({ attempt, delay, status: response.status, source }, 'Retryable HTTP error, retrying');
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry<T>(url, options, attempt + 1);
      }
      logger.error({ status: response.status, source }, 'HTTP error');
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (attempt <= MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn({ attempt, delay, source }, 'Network error, retrying');
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry<T>(url, options, attempt + 1);
    }
    logger.error({ error, source }, 'Fetch failed after retries');
    return null;
  }
}
