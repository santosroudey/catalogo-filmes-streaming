import { hasProviderParam, parseFilters, type CatalogFilters, type SearchParams } from "@/lib/filters";

export function resolveFilters(sp: SearchParams, savedProviders: number[] | null): CatalogFilters {
  const f = parseFilters(sp);
  if (!hasProviderParam(sp) && savedProviders?.length) return { ...f, providers: savedProviders };
  return f;
}
