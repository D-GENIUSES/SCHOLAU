export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
