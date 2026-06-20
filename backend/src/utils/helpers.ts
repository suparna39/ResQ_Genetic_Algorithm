/**
 * Extract a single string param from Express params
 * (Express 5 types params as string | string[])
 */
export function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

/**
 * Simple ISO timestamp
 */
export function nowIso(): string {
  return new Date().toISOString();
}
